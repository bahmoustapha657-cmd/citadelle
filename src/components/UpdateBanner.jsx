import { useUpdateBanner } from "./update-banner/use-update-banner";
import { AutoReloadToast } from "./update-banner/AutoReloadToast";
import { UpdateAvailableBanner } from "./update-banner/UpdateAvailableBanner";

export default function UpdateBanner() {
  const { available, autoToast, plusTard } = useUpdateBanner();

  if (autoToast) return <AutoReloadToast />;
  if (!available) return null;
  return <UpdateAvailableBanner plusTard={plusTard} />;
}
