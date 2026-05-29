// main.rs - Thin desktop entry point. All app logic lives in lib.rs (fitnotes_lib).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    fitnotes_lib::run();
}
