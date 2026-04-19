<?php
/**
 * Thin HTTP client for POSTing payloads to the Locksmith dashboard API.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class Leads_Sync_Client {

	public static function post( $path, array $body, $timeout = 10 ) {
		if ( ! Leads_Sync_Settings::is_configured() ) {
			return new WP_Error( 'leads_sync_not_configured', 'Leads Sync endpoint/API key not set.' );
		}

		$url = Leads_Sync_Settings::endpoint() . $path;

		$response = wp_remote_post( $url, array(
			'timeout'  => $timeout,
			'blocking' => true,
			'headers'  => array(
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
				'X-Api-Key'     => Leads_Sync_Settings::api_key(),
				'X-Site-Domain' => wp_parse_url( home_url(), PHP_URL_HOST ),
				'User-Agent'    => 'LeadsSync/' . LEADS_SYNC_VERSION . '; WP/' . get_bloginfo( 'version' ),
			),
			'body'    => wp_json_encode( $body ),
		) );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );

		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error( 'leads_sync_http_' . $code, "HTTP $code: $body" );
		}

		return json_decode( $body, true );
	}
}
