#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

#[napi]
pub fn greet() -> String {
  "Hello from Rust! 🦀".to_string()
}

#[napi]
pub fn generate_thumbnails(path: String) -> String {
  // Stub implementation
  format!("Stub: would generate thumbnails for {}", path)
}
