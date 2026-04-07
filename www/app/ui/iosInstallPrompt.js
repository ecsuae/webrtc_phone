import { checkIOSInstallation as checkIOSInstallationImpl } from "./iosInstallPrompt/core.js";
import { hideAllBanners as hideAllBannersImpl } from "./iosInstallPrompt/banners.js";

export function checkIOSInstallation() {
  return checkIOSInstallationImpl();
}

export function hideAllBanners() {
  hideAllBannersImpl();
}
