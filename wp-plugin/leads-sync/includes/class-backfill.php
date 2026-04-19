<?php
/**
 * Reads Elementor Pro's `wp_e_submissions` tables and bulk-pushes everything
 * to the dashboard. Idempotent: the dashboard dedupes on (site, external_id).
 *
 * Elementor Pro 3.5+ stores submissions in:
 *   {prefix}e_submissions          — one row per submission
 *   {prefix}e_submissions_values   — one row per field value
 *   {prefix}e_submissions_actions_log
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class Leads_Sync_Backfill {

	const BATCH_SIZE = 100;
	const AJAX_ACTION = 'leads_sync_backfill';

	public static function init() {
		add_action( 'wp_ajax_' . self::AJAX_ACTION, array( __CLASS__, 'handle_ajax' ) );
	}

	public static function handle_ajax() {
		check_ajax_referer( self::AJAX_ACTION, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'forbidden' ), 403 );
		}

		$offset = isset( $_POST['offset'] ) ? max( 0, absint( $_POST['offset'] ) ) : 0;
		$result = self::run_batch( $offset, self::BATCH_SIZE );
		wp_send_json_success( $result );
	}

	public static function run_batch( $offset, $limit ) {
		global $wpdb;

		// Fail loudly here rather than deep in the HTTP client so the admin UI
		// shows exactly which setting is missing.
		if ( ! Leads_Sync_Settings::is_configured() ) {
			$s = Leads_Sync_Settings::get();
			return array(
				'done'   => true,
				'synced' => 0,
				'total'  => 0,
				'error'  => 'Settings not configured. endpoint="' . $s['endpoint'] . '" api_key_len=' . strlen( $s['api_key'] ),
			);
		}

		$prefix = $wpdb->prefix;

		$submissions_table = $prefix . 'e_submissions';
		$values_table      = $prefix . 'e_submissions_values';
		$actions_table     = $prefix . 'e_submissions_actions_log';

		// Confirm Elementor tables exist before we try to read them.
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $submissions_table ) ) !== $submissions_table ) {
			return array(
				'done'   => true,
				'synced' => 0,
				'total'  => 0,
				'error'  => 'Elementor submissions table not found — is Elementor Pro 3.5+ active?',
			);
		}

		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$submissions_table}" );
		if ( $total === 0 ) {
			return array( 'done' => true, 'synced' => 0, 'total' => 0 );
		}

		// Inspect real columns so we pull what actually exists on this Elementor version.
		$cols = $wpdb->get_col( "SHOW COLUMNS FROM {$submissions_table}" );
		if ( empty( $cols ) ) {
			return array(
				'done'  => true, 'synced' => 0, 'total' => $total,
				'error' => 'Could not read columns from ' . $submissions_table . ': ' . $wpdb->last_error,
			);
		}

		// Pull full row with * — easier than guessing column names across Elementor Pro versions.
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$submissions_table} ORDER BY id ASC LIMIT %d OFFSET %d",
			$limit,
			$offset
		), ARRAY_A );

		if ( $wpdb->last_error ) {
			return array(
				'done'  => true, 'synced' => $offset, 'total' => $total,
				'error' => 'SQL error on submissions query: ' . $wpdb->last_error,
				'cols'  => $cols,
			);
		}

		if ( empty( $rows ) ) {
			return array(
				'done'   => true,
				'synced' => $offset,
				'total'  => $total,
				'error'  => 'Zero rows returned at offset ' . $offset . ' (total=' . $total . '). Columns: ' . implode( ',', $cols ),
			);
		}

		$ids = array_column( $rows, 'id' );
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$values = $wpdb->get_results( $wpdb->prepare(
			"SELECT submission_id, `key`, value
			 FROM {$values_table}
			 WHERE submission_id IN ($placeholders)",
			$ids
		), ARRAY_A );

		$values_by_submission = array();
		foreach ( $values as $v ) {
			$values_by_submission[ $v['submission_id'] ][ $v['key'] ] = $v['value'];
		}

		// Aggregate action-level status per submission from the actions_log.
		// This is the ground truth for Elementor's green-check / warning UI:
		//  - every action row has status='success'  → submission 'success'
		//  - any action row != 'success'            → submission 'failed'
		//  - no rows logged at all                  → fall back to $row['status']
		$status_by_submission = array();
		$actions_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $actions_table ) ) === $actions_table;
		if ( $actions_exists ) {
			$action_rows = $wpdb->get_results( $wpdb->prepare(
				"SELECT submission_id,
				        SUM(CASE WHEN LOWER(status) = 'success' THEN 1 ELSE 0 END) AS ok_count,
				        COUNT(*) AS total_count
				 FROM {$actions_table}
				 WHERE submission_id IN ($placeholders)
				 GROUP BY submission_id",
				$ids
			), ARRAY_A );
			foreach ( (array) $action_rows as $ar ) {
				$ok    = (int) $ar['ok_count'];
				$total = (int) $ar['total_count'];
				$status_by_submission[ $ar['submission_id'] ] = ( $total > 0 && $ok === $total ) ? 'success' : 'failed';
			}
		}

		$payload = array();
		foreach ( $rows as $row ) {
			$data = isset( $values_by_submission[ $row['id'] ] ) ? $values_by_submission[ $row['id'] ] : array();
			// Elementor Pro column names vary slightly across versions — fall back gracefully.
			$form_key  = $row['form_id']    ?? $row['element_id']     ?? 'unknown';
			$form_name = $row['form_name']  ?? $row['post_id']        ?? 'Unnamed Form';
			$status = isset( $status_by_submission[ $row['id'] ] )
				? $status_by_submission[ $row['id'] ]
				: self::normalize_status( $row['status'] ?? null );

			$payload[] = array(
				'external_id'       => (int) $row['id'],
				'elementor_form_id' => (string) $form_key,
				'form_name'         => (string) $form_name,
				'submitted_at'      => mysql_to_rfc3339( $row['created_at'] ?? $row['created_at_gmt'] ?? current_time( 'mysql' ) ),
				'data'              => $data,
				'ip'                => $row['user_ip'] ?? null,
				'user_agent'        => $row['user_agent'] ?? '',
				'referrer'         => $row['referer'] ?? ( $row['referer_title'] ?? '' ),
				'status'            => $status,
			);
		}

		$result = Leads_Sync_Client::post( '/api/backfill', array( 'submissions' => $payload ), 30 );

		if ( is_wp_error( $result ) ) {
			return array(
				'done'   => false,
				'synced' => $offset,
				'total'  => $total,
				'error'  => $result->get_error_message(),
			);
		}

		$new_offset = $offset + count( $rows );
		Leads_Sync_Settings::save( array(
			'last_sync_at'    => time(),
			'last_sync_count' => $new_offset,
		) );

		return array(
			'done'   => $new_offset >= $total,
			'synced' => $new_offset,
			'total'  => $total,
			'batch'  => count( $rows ),
		);
	}

	/**
	 * Fallback normalizer used when wp_e_submissions_actions_log is missing
	 * or empty. Elementor Pro stores wp_e_submissions.status as one of
	 * 'new' | 'completed' | 'read' | 'trash' | 'spam' — 'completed' / 'read'
	 * imply all actions succeeded; 'new' just means the row was stored and
	 * actions haven't finalized (treat as success to avoid false positives).
	 */
	private static function normalize_status( $raw ) {
		$s = strtolower( (string) $raw );
		if ( $s === '' )                                               return 'success';
		if ( in_array( $s, array( 'success', 'completed', 'read', 'new' ), true ) ) return 'success';
		return 'failed';
	}
}
