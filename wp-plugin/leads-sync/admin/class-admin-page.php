<?php
/**
 * Settings screen under Settings → Leads Sync.
 * - Configure dashboard URL + API key
 * - Test connection
 * - Trigger historical backfill (batched via AJAX)
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class Leads_Sync_Admin_Page {

	const SLUG = 'leads-sync';

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'admin_post_leads_sync_test', array( __CLASS__, 'handle_test' ) );
		add_action( 'wp_ajax_leads_sync_diag', array( __CLASS__, 'handle_diag' ) );
	}

	public static function handle_diag() {
		check_ajax_referer( 'leads_sync_diag' );
		if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( array( 'message' => 'forbidden' ), 403 );

		global $wpdb;
		$prefix = $wpdb->prefix;
		$t_sub  = $prefix . 'e_submissions';
		$t_act  = $prefix . 'e_submissions_actions_log';
		$t_val  = $prefix . 'e_submissions_values';

		$sub_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $t_sub ) ) === $t_sub;
		$act_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $t_act ) ) === $t_act;
		$val_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $t_val ) ) === $t_val;

		$settings = Leads_Sync_Settings::get();

		wp_send_json_success( array(
			'plugin_version'         => LEADS_SYNC_VERSION,
			'wp_prefix'              => $prefix,
			'submissions_table'      => $t_sub,
			'submissions_exists'     => $sub_exists,
			'submissions_count'      => $sub_exists ? (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t_sub}" ) : null,
			'submissions_columns'    => $sub_exists ? $wpdb->get_col( "SHOW COLUMNS FROM {$t_sub}" ) : array(),
			'submissions_min_id'     => $sub_exists ? (int) $wpdb->get_var( "SELECT MIN(id) FROM {$t_sub}" ) : null,
			'submissions_max_id'     => $sub_exists ? (int) $wpdb->get_var( "SELECT MAX(id) FROM {$t_sub}" ) : null,
			'actions_log_exists'     => $act_exists,
			'actions_log_count'      => $act_exists ? (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t_act}" ) : null,
			'actions_log_columns'    => $act_exists ? $wpdb->get_col( "SHOW COLUMNS FROM {$t_act}" ) : array(),
			'values_table_exists'    => $val_exists,
			'settings_endpoint'      => $settings['endpoint'],
			'settings_api_key_len'   => strlen( $settings['api_key'] ),
			'settings_last_sync_at'  => $settings['last_sync_at'],
			'settings_last_sync_cnt' => $settings['last_sync_count'],
			'is_configured'          => Leads_Sync_Settings::is_configured(),
		) );
	}

	public static function menu() {
		add_options_page(
			'Leads Sync',
			'Leads Sync',
			'manage_options',
			self::SLUG,
			array( __CLASS__, 'render' )
		);
	}

	public static function register_settings() {
		register_setting( 'leads_sync_group', Leads_Sync_Settings::OPTION_KEY, array(
			'sanitize_callback' => array( __CLASS__, 'sanitize' ),
		) );
	}

	public static function sanitize( $input ) {
		$current = Leads_Sync_Settings::get();
		return array_merge( $current, array(
			'endpoint' => esc_url_raw( trim( $input['endpoint'] ?? '' ) ),
			'api_key'  => sanitize_text_field( trim( $input['api_key'] ?? '' ) ),
		) );
	}

	public static function handle_test() {
		check_admin_referer( 'leads_sync_test' );
		if ( ! current_user_can( 'manage_options' ) ) wp_die( 'forbidden' );

		$result = Leads_Sync_Client::post( '/api/heartbeat', array(
			'wp_version'     => get_bloginfo( 'version' ),
			'plugin_version' => LEADS_SYNC_VERSION,
			'meta'           => array( 'test' => true ),
		), 10 );

		$ok = ! is_wp_error( $result );
		set_transient( 'leads_sync_test_result', array(
			'ok'      => $ok,
			'message' => $ok ? 'Connection OK.' : $result->get_error_message(),
		), 60 );

		wp_safe_redirect( admin_url( 'options-general.php?page=' . self::SLUG ) );
		exit;
	}

	public static function render() {
		$settings = Leads_Sync_Settings::get();
		$test     = get_transient( 'leads_sync_test_result' );
		if ( $test ) delete_transient( 'leads_sync_test_result' );
		?>
		<div class="wrap">
			<h1>Leads Sync</h1>
			<p>Push Elementor form submissions to your central dashboard.</p>

			<?php if ( $test ) : ?>
				<div class="notice notice-<?php echo $test['ok'] ? 'success' : 'error'; ?>">
					<p><strong><?php echo $test['ok'] ? 'Success:' : 'Error:'; ?></strong> <?php echo esc_html( $test['message'] ); ?></p>
				</div>
			<?php endif; ?>

			<form method="post" action="options.php">
				<?php settings_fields( 'leads_sync_group' ); ?>
				<table class="form-table">
					<tr>
						<th><label for="endpoint">Dashboard URL</label></th>
						<td>
							<input type="url" id="endpoint" name="<?php echo Leads_Sync_Settings::OPTION_KEY; ?>[endpoint]"
							       value="<?php echo esc_attr( $settings['endpoint'] ); ?>" class="regular-text"
							       placeholder="https://dashboard.example.com" />
							<p class="description">Root URL of the Locksmith dashboard (no trailing slash).</p>
						</td>
					</tr>
					<tr>
						<th><label for="api_key">API Key</label></th>
						<td>
							<input type="text" id="api_key" name="<?php echo Leads_Sync_Settings::OPTION_KEY; ?>[api_key]"
							       value="<?php echo esc_attr( $settings['api_key'] ); ?>" class="regular-text code" />
							<p class="description">Generated for this site in the dashboard's Sites screen.</p>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>

			<hr>

			<h2>Test connection</h2>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( 'leads_sync_test' ); ?>
				<input type="hidden" name="action" value="leads_sync_test" />
				<button type="submit" class="button">Send test heartbeat</button>
			</form>

			<hr>

			<h2>Diagnostics</h2>
			<p>Dumps the real Elementor table state so we can see what the sync is working with.</p>
			<button id="leads-sync-diag" class="button">Run diagnostics</button>
			<pre id="leads-sync-diag-out" style="background:#fff;border:1px solid #ccd;padding:1em;margin-top:1em;max-width:800px;overflow:auto;display:none;font-size:12px;"></pre>
			<script>
			(function(){
				const btn = document.getElementById('leads-sync-diag');
				const out = document.getElementById('leads-sync-diag-out');
				if (!btn) return;
				const nonce = '<?php echo wp_create_nonce( 'leads_sync_diag' ); ?>';
				const url   = '<?php echo admin_url( 'admin-ajax.php' ); ?>';
				btn.addEventListener('click', async () => {
					btn.disabled = true;
					out.style.display = 'block';
					out.textContent = 'Running...';
					const body = new URLSearchParams({ action: 'leads_sync_diag', _wpnonce: nonce });
					try {
						const res  = await fetch(url, { method: 'POST', body, credentials: 'same-origin' });
						const json = await res.json();
						out.textContent = JSON.stringify(json.data || json, null, 2);
					} catch (e) {
						out.textContent = 'Request failed: ' + e;
					}
					btn.disabled = false;
				});
			})();
			</script>

			<hr>

			<h2>Historical backfill</h2>
			<p>Pushes every existing row from Elementor's submissions table. Safe to re-run — the dashboard dedupes.</p>
			<?php if ( $settings['last_sync_at'] ) : ?>
				<p><em>Last sync: <?php echo esc_html( human_time_diff( $settings['last_sync_at'] ) ); ?> ago — <?php echo (int) $settings['last_sync_count']; ?> records.</em></p>
			<?php endif; ?>
			<button id="leads-sync-start" class="button button-primary" <?php disabled( ! Leads_Sync_Settings::is_configured() ); ?>>Sync Historical Now</button>
			<div id="leads-sync-progress" style="margin-top:1em; display:none;">
				<progress id="leads-sync-bar" value="0" max="100" style="width: 400px; height: 20px;"></progress>
				<div id="leads-sync-status" style="margin-top: .5em;"></div>
			</div>
			<script>
			(function(){
				const btn    = document.getElementById('leads-sync-start');
				const wrap   = document.getElementById('leads-sync-progress');
				const bar    = document.getElementById('leads-sync-bar');
				const status = document.getElementById('leads-sync-status');
				if (!btn) return;
				const nonce  = '<?php echo wp_create_nonce( Leads_Sync_Backfill::AJAX_ACTION ); ?>';
				const url    = '<?php echo admin_url( 'admin-ajax.php' ); ?>';

				btn.addEventListener('click', async () => {
					btn.disabled = true;
					wrap.style.display = 'block';
					let offset = 0;
					while (true) {
						const body = new URLSearchParams({ action: '<?php echo Leads_Sync_Backfill::AJAX_ACTION; ?>', nonce, offset });
						const res  = await fetch(url, { method: 'POST', body, credentials: 'same-origin' });
						const json = await res.json();
						if (!json.success) {
							status.textContent = 'Failed: ' + (json.data && json.data.message || 'unknown');
							btn.disabled = false;
							return;
						}
						const d = json.data;
						if (d.error) {
							status.textContent = 'Error: ' + d.error;
							btn.disabled = false;
							return;
						}
						bar.max    = d.total;
						bar.value  = d.synced;
						status.textContent = `${d.synced} / ${d.total} synced`;
						if (d.done) { status.textContent += ' — complete.'; btn.disabled = false; return; }
						offset = d.synced;
					}
				});
			})();
			</script>
		</div>
		<?php
	}
}
