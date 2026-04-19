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
		$prefix = $wpdb->prefix;

		$submissions_table = $prefix . 'e_submissions';
		$values_table      = $prefix . 'e_submissions_values';

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

		// Pull a batch of submissions ordered oldest-first so resume is deterministic.
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, form_name, form_id, created_at, referer, user_agent, user_ip
			 FROM {$submissions_table}
			 ORDER BY id ASC
			 LIMIT %d OFFSET %d",
			$limit,
			$offset
		), ARRAY_A );

		if ( empty( $rows ) ) {
			return array( 'done' => true, 'synced' => $offset, 'total' => $total );
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

		$payload = array();
		foreach ( $rows as $row ) {
			$data = isset( $values_by_submission[ $row['id'] ] ) ? $values_by_submission[ $row['id'] ] : array();
			$payload[] = array(
				'external_id'       => (int) $row['id'],
				'elementor_form_id' => (string) $row['form_id'],
				'form_name'         => (string) $row['form_name'],
				'submitted_at'      => mysql_to_rfc3339( $row['created_at'] ),
				'data'              => $data,
				'ip'                => $row['user_ip'] ?: null,
				'user_agent'        => $row['user_agent'] ?: '',
				'referrer'         => $row['referer'] ?: '',
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
}
