using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public enum RushCityQualityTier { Low, Medium, High, Ultra }

    public sealed class RushCityQualityManager : MonoBehaviour
    {
        public static RushCityQualityManager Instance { get; private set; }
        public RushCityQualityTier Tier { get; private set; }
        public int TargetFps { get; private set; } = 60;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            ApplyBestProfile();
        }

        public void ApplyBestProfile()
        {
            var ram = SystemInfo.systemMemorySize;
            var vram = SystemInfo.graphicsMemorySize;
            var cores = SystemInfo.processorCount;

            if (ram >= 10000 && vram >= 5000 && cores >= 8) Tier = RushCityQualityTier.Ultra;
            else if (ram >= 7000 && vram >= 3000 && cores >= 8) Tier = RushCityQualityTier.High;
            else if (ram >= 4500 && vram >= 1500) Tier = RushCityQualityTier.Medium;
            else Tier = RushCityQualityTier.Low;

#if UNITY_2022_2_OR_NEWER
            var refresh = Mathf.RoundToInt((float)Screen.currentResolution.refreshRateRatio.value);
#else
            var refresh = Screen.currentResolution.refreshRate;
#endif
            if(refresh<=0)refresh=60;
            TargetFps = refresh >= 120 && Tier >= RushCityQualityTier.High ? 120 : refresh >= 90 && Tier >= RushCityQualityTier.Medium ? 90 : 60;
            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = TargetFps;
            QualitySettings.lodBias = Tier == RushCityQualityTier.Low ? .65f : Tier == RushCityQualityTier.Medium ? 1f : Tier == RushCityQualityTier.High ? 1.35f : 1.7f;
            QualitySettings.shadowDistance = Tier == RushCityQualityTier.Low ? 22f : Tier == RushCityQualityTier.Medium ? 38f : Tier == RushCityQualityTier.High ? 58f : 75f;
            QualitySettings.anisotropicFiltering = Tier >= RushCityQualityTier.High ? AnisotropicFiltering.ForceEnable : AnisotropicFiltering.Enable;
            Debug.Log($"[Rush City] quality={Tier} targetFps={TargetFps} ram={ram}MB vram={vram}MB cores={cores}");
        }
    }
}
