use std::env;

use tauri::{
    webview::PageLoadEvent,
    AppHandle,
    Manager,
    WebviewUrl,
    WebviewWindowBuilder,
};
use url::Url;

const PRODUCT_NAME: &str = "MiNeko Herness";

fn requested_url() -> Result<Url, String> {
    let mut args = env::args().skip(1);
    let mut value = None;
    while let Some(arg) = args.next() {
        if let Some(url) = arg.strip_prefix("--url=") {
            value = Some(url.to_owned());
            break;
        }
        if arg == "--url" {
            value = args.next();
            break;
        }
    }
    let raw = value.ok_or_else(|| "MiNeko Herness requires --url <loopback-url>".to_owned())?;
    let url = Url::parse(&raw).map_err(|error| format!("invalid desktop URL: {error}"))?;
    if url.scheme() != "http"
        || url.host_str() != Some("127.0.0.1")
        || url.port().is_none()
        || url.username() != ""
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("desktop URL must be an http://127.0.0.1:<port> URL".to_owned());
    }
    Ok(url)
}

fn focus_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn allows_navigation(candidate: &Url, expected: &Url) -> bool {
    candidate.scheme() == expected.scheme()
        && candidate.host_str() == expected.host_str()
        && candidate.port_or_known_default() == expected.port_or_known_default()
}

fn main() {
    let url = match requested_url() {
        Ok(url) => url,
        Err(message) => {
            eprintln!("{message}");
            std::process::exit(2);
        }
    };
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| focus_main(app)))
        .setup(move |app| {
            let window_url = url.clone();
            let navigation_target = url.clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(window_url))
                .title(PRODUCT_NAME)
                .inner_size(1360.0, 900.0)
                .min_inner_size(960.0, 640.0)
                .visible(false)
                .on_navigation(move |candidate| allows_navigation(candidate, &navigation_target))
                .on_page_load(|window, payload| {
                    if payload.event() == PageLoadEvent::Finished {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MiNeko Herness native shell");
}
