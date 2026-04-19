<?php
/**
 * Sends a 5-minute health heartbeat to the dashboard so the admin can
 * see each site's status without waiting for the next lead.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class Leads_Sync_Heartbeat {

	public static function init() {
		add_action( 'leads_sync_heartbeat', array( __CLASS__, 'send' ) );
	}

	public static function send() {
		if ( ! Leads_Sync_Settings::is_configured() ) {
			return;
		}

		global $wpdb;
		$submissions_table = $wpdb->prefix . 'e_submissions';

		$last_submission_at = null;
		$active_forms_count = 0;
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $submissions_table ) ) === $submissions_table ) {
			$last_submission_at = $wpdb->get_var( "SELECT MAX(created_at) FROM {$submissions_table}" );
			$active_forms_count = (int) $wpdb->get_var( "SELECT COUNT(DISTINCT form_id) FROM {$submissions_table}" );
			$last_submission_at = $last_submission_at ? mysql_to_rfc3339( $last_submission_at ) : null;
		}

		$payload = array(
			'wp_version'            => get_bloginfo( 'version' ),
			'php_version'           => PHP_VERSION,
			'elementor_version'     => defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : null,
			'elementor_pro_version' => defined( 'ELEMENTOR_PRO_VERSION' ) ? ELEMENTOR_PRO_VERSION : null,
			'plugin_version'        => LEADS_SYNC_VERSION,
			'active_forms_count'    => $active_forms_count,
			'last_submission_at'    => $last_submission_at,
			'php_errors_count'      => 0,
			'meta'                  => array(
				'timezone'   => wp_timezone_string(),
				'site_url'   => home_url(),
				'multisite'  => is_multisite(),
			),
		);

		Leads_Sync_Client::post( '/api/heartbeat', $payload, 6 );
	}
}
