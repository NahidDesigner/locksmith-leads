<?php
/**
 * Captures every Elementor Pro form submission and pushes it to the dashboard.
 *
 * Hook fires server-side AFTER WordPress processes the submission,
 * so Cloudflare / WP Rocket / LiteSpeed caching does not affect it.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class Leads_Sync_Submission_Hook {

	public static function init() {
		// Fires once the Elementor Pro form has validated + stored the record.
		add_action( 'elementor_pro/forms/new_record', array( __CLASS__, 'on_new_record' ), 10, 2 );
	}

	public static function on_new_record( $record, $handler ) {
		if ( ! Leads_Sync_Settings::is_configured() ) {
			return;
		}

		try {
			$form      = $record->get_form_settings( 'form_name' ) ?: 'Unnamed Form';
			$form_id   = $record->get_form_settings( 'id' ) ?: 'unknown';
			$fields    = $record->get( 'fields' );
			$meta      = $record->get( 'meta' );

			$data   = array();
			$schema = array();
			foreach ( (array) $fields as $id => $field ) {
				$data[ $id ] = isset( $field['value'] ) ? $field['value'] : '';
				$schema[]    = array(
					'id'    => $id,
					'label' => isset( $field['title'] ) ? $field['title'] : $id,
					'type'  => isset( $field['type'] )  ? $field['type']  : 'text',
				);
			}

			$payload = array(
				'form' => array(
					'elementor_form_id' => (string) $form_id,
					'form_name'         => (string) $form,
					'page_url'          => isset( $meta['page_url']['value'] ) ? $meta['page_url']['value'] : ( isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '' ),
					'field_schema'      => $schema,
				),
				'submission' => array(
					'submitted_at' => gmdate( 'c' ),
					'data'         => $data,
					'ip'           => self::client_ip(),
					'user_agent'   => isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '',
					'referrer'    => isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '',
					'utm'          => self::extract_utm( $meta ),
					'source'       => 'realtime',
				),
			);

			$result = Leads_Sync_Client::post( '/api/ingest', $payload, 8 );

			if ( is_wp_error( $result ) ) {
				self::queue_retry( $payload, $result->get_error_message() );
			}
		} catch ( \Throwable $e ) {
			error_log( '[LeadsSync] submission hook error: ' . $e->getMessage() );
		}
	}

	private static function client_ip() {
		// Prefer Cloudflare's real-IP header if present.
		foreach ( array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' ) as $h ) {
			if ( ! empty( $_SERVER[ $h ] ) ) {
				$ip = trim( explode( ',', wp_unslash( $_SERVER[ $h ] ) )[0] );
				if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) return $ip;
			}
		}
		return null;
	}

	private static function extract_utm( $meta ) {
		$utm = array();
		if ( ! is_array( $meta ) ) return $utm;
		foreach ( $meta as $key => $entry ) {
			if ( strpos( $key, 'utm_' ) === 0 && isset( $entry['value'] ) ) {
				$utm[ $key ] = $entry['value'];
			}
		}
		return $utm;
	}

	/**
	 * Store failed pushes in a transient queue for later retry.
	 * A simple ring buffer — keeps up to 200 pending items per site.
	 */
	private static function queue_retry( $payload, $error ) {
		$queue   = get_option( 'leads_sync_retry_queue', array() );
		$queue[] = array(
			'payload' => $payload,
			'error'   => $error,
			'queued'  => time(),
		);
		if ( count( $queue ) > 200 ) {
			$queue = array_slice( $queue, -200 );
		}
		update_option( 'leads_sync_retry_queue', $queue, false );
	}
}
