<?php
/**
 * Plugin Name:       Leads Sync
 * Plugin URI:        https://github.com/locksmithsites/leads-sync
 * Description:       Pushes Elementor Pro form submissions to the central Locksmith Sites dashboard in real time, supports historical backfill, and sends health heartbeats.
 * Version:           1.0.2
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Locksmith Sites
 * License:           GPL-2.0-or-later
 * Text Domain:       leads-sync
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LEADS_SYNC_VERSION', '1.0.2' );
define( 'LEADS_SYNC_FILE', __FILE__ );
define( 'LEADS_SYNC_DIR', plugin_dir_path( __FILE__ ) );
define( 'LEADS_SYNC_URL', plugin_dir_url( __FILE__ ) );

require_once LEADS_SYNC_DIR . 'includes/class-settings.php';
require_once LEADS_SYNC_DIR . 'includes/class-client.php';
require_once LEADS_SYNC_DIR . 'includes/class-submission-hook.php';
require_once LEADS_SYNC_DIR . 'includes/class-backfill.php';
require_once LEADS_SYNC_DIR . 'includes/class-heartbeat.php';
require_once LEADS_SYNC_DIR . 'admin/class-admin-page.php';

// Bootstrap
add_action( 'plugins_loaded', function () {
	Leads_Sync_Settings::init();
	Leads_Sync_Submission_Hook::init();
	Leads_Sync_Heartbeat::init();

	if ( is_admin() ) {
		Leads_Sync_Admin_Page::init();
		Leads_Sync_Backfill::init();
	}
} );

// Schedule heartbeat cron on activation, clear on deactivation.
register_activation_hook( __FILE__, function () {
	if ( ! wp_next_scheduled( 'leads_sync_heartbeat' ) ) {
		wp_schedule_event( time() + 60, 'leads_sync_5min', 'leads_sync_heartbeat' );
	}
} );

register_deactivation_hook( __FILE__, function () {
	wp_clear_scheduled_hook( 'leads_sync_heartbeat' );
} );

// Custom 5-minute cron interval.
add_filter( 'cron_schedules', function ( $schedules ) {
	$schedules['leads_sync_5min'] = array(
		'interval' => 5 * MINUTE_IN_SECONDS,
		'display'  => __( 'Every 5 minutes', 'leads-sync' ),
	);
	return $schedules;
} );
