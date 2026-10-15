import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/**
 * Hands the backup to the share sheet (Save to Files, AirDrop, email). In a browser or the home screen app it uses
 * the browser's share sheet when it can share files, and downloads the file otherwise.
 * Resolves false if you close the share sheet without saving.
 */
export async function saveBackupFile(text: string, name: string): Promise<boolean> {
  if (Platform.OS === "web") {
    const file = new globalThis.File([text], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return true;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return false;
        throw e;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this phone.");
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json", dialogTitle: "Save your PayCheck backup" });
  return true;
}

/** Lets you pick a backup file and returns its text, or null if you cancel. */
export async function pickBackupFile(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "public.json"], copyToCacheDirectory: true });
  if (r.canceled || !r.assets.length) return null;
  const asset = r.assets[0];
  if (Platform.OS === "web") return asset.file ? asset.file.text() : (await fetch(asset.uri)).text();
  return new File(asset.uri).text();
}
