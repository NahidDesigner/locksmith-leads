<?php
/**
 * Privacy-friendly visitor beacon.
 *
 * Emits a tiny inline script in the site footer that POSTs each page
 * view to the dashboard's `/api/track` endpoint via
 * `navigator.sendBeacon` — no cookies, no external JS file to download,
 * and no render-blocking overhead (sendBeacon fires async in the
 * background even as the page unloads).
 *
 * Skips:
 *   - wp-admin and AJAX requests
 *   - feeds / robots / sitemap / preview
 *   - logged-in admins (so the agency doesn't pollute their own numbers)
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class Leads_Sync_Tracker {

	public static function init() {
		add_action( 'wp_footer', array( __CLASS__, 'emit_beacon' ), 99 );
	}

	public static function emit_beacon() {
		if ( ! self::should_track() ) {
			return;
		}

		$settings = Leads_Sync_Settings::get();
		$endpoint = rtrim( (string) $settings['endpoint'], '/' ) . '/api/track';
		$api_key  = (string) $settings['api_key'];

		// wp_json_encode handles escaping for embedding inside a <script> block.
		$endpoint_js = wp_json_encode( $endpoint );
		$api_key_js  = wp_json_encode( $api_key );

		?>
		<script data-leads-sync-tracker>
		(function(){
			try {
				// Dedup with the optional Cloudflare Worker injector:
				// whichever script executes first sets __leadsSyncFired and
				// the other exits early. Matters on non-cached pages that
				// contain both the plugin script and the edge-injected one.
				if (window.__leadsSyncFired) return;
				window.__leadsSyncFired = true;
				var body = JSON.stringify({
					key: <?php echo $api_key_js; ?>,
					path: location.pathname + location.search,
					referrer: document.referrer || ""
				});
				var url = <?php echo $endpoint_js; ?>;
				// sendBeacon is fire-and-forget, safe during unload, and uses
				// text/plain by default so no CORS preflight is needed.
				var blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
				if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
				fetch(url, {
					method: "POST",
					body: body,
					keepalive: true,
					headers: { "Content-Type": "text/plain;charset=UTF-8" }
				}).catch(function(){});
			} catch (e) {}
		})();
		</script>
		<?php
	}

	private static function should_track() {
		if ( ! Leads_Sync_Settings::is_configured() ) return false;
		if ( is_admin() )                              return false;
		if ( wp_doing_ajax() )                         return false;
		if ( is_feed() || is_robots() || is_preview() ) return false;

		// Skip logged-in admins so their sessions don't pollute visitor counts.
		if ( is_user_logged_in() && current_user_can( 'manage_options' ) ) {
			return false;
		}

		return true;
	}
}
