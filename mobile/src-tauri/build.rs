fn main() {
    ensure_android_network_state_permission();
    sync_android_frontend_assets();
    tauri_build::build();
}

fn sync_android_frontend_assets() {
    let frontend_dist = std::path::Path::new("../../frontend/dist");
    let android_assets = std::path::Path::new("gen/android/app/src/main/assets");

    if !frontend_dist.exists() || !android_assets.exists() {
        return;
    }

    clear_dir(android_assets).expect("failed to clear generated Android frontend assets");
    copy_dir(frontend_dist, android_assets).expect("failed to sync frontend dist to Android assets");
}

fn clear_dir(path: &std::path::Path) -> std::io::Result<()> {
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        if entry.file_name() == "tauri.conf.json" {
            continue;
        }
        let entry_path = entry.path();
        if entry_path.is_dir() {
            std::fs::remove_dir_all(entry_path)?;
        } else {
            std::fs::remove_file(entry_path)?;
        }
    }
    Ok(())
}

fn copy_dir(from: &std::path::Path, to: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let source = entry.path();
        let target = to.join(entry.file_name());
        if source.is_dir() {
            copy_dir(&source, &target)?;
        } else {
            std::fs::copy(source, target)?;
        }
    }
    Ok(())
}

fn ensure_android_network_state_permission() {
    let manifest_path = std::path::Path::new("gen/android/app/src/main/AndroidManifest.xml");
    let Ok(mut manifest) = std::fs::read_to_string(manifest_path) else {
        return;
    };

    let permission =
        r#"    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />"#;

    if manifest.contains("android.permission.ACCESS_NETWORK_STATE") {
        return;
    }

    let internet_permission =
        r#"    <uses-permission android:name="android.permission.INTERNET" />"#;
    if manifest.contains(internet_permission) {
        manifest = manifest.replace(
            internet_permission,
            &format!("{}\n{}", internet_permission, permission),
        );
    } else {
        manifest = manifest.replace(
            "<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\">",
            &format!(
                "<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\">\n{}",
                permission
            ),
        );
    }

    std::fs::write(manifest_path, manifest)
        .expect("failed to update AndroidManifest.xml network state permission");
}
