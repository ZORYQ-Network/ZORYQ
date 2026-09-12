using System;
using UnityEngine;
using Zoryq.Play;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityGameManager : MonoBehaviour
    {
        public static RushCityGameManager Instance { get; private set; }

        [Header("Pacing")]
        [SerializeField] float baseSpeed = 12f;
        [SerializeField] float maxSpeed = 32f;
        [SerializeField] float speedGainPerSecond = 0.16f;
        [SerializeField] float chasePressureGain = 0.018f;
        [SerializeField] float chasePressureRecovery = 0.11f;

        public bool IsRunning { get; private set; }
        public float CurrentSpeed { get; private set; }
        public float DistanceMeters { get; private set; }
        public float DurationSeconds { get; private set; }
        public float ChasePressure { get; private set; }
        public float SkillFlow { get; private set; }
        public int ZqCollected { get; private set; }
        public int Score { get; private set; }
        public int Combo { get; private set; } = 1;
        public string SessionId { get; private set; }
        public bool MagnetActive => _magnetUntil > Time.time;
        public bool ShieldActive => _shieldCharges > 0;
        public bool OverdriveActive => _overdriveUntil > Time.time;
        public int ScoreMultiplier => _multiplierUntil > Time.time ? 2 : 1;

        float _lastCollectTime, _magnetUntil, _overdriveUntil, _multiplierUntil;
        int _shieldCharges, _bonusScore, _bonusZq;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        void Start() => BeginRun();

        void Update()
        {
            if (!IsRunning) return;
            DurationSeconds += Time.deltaTime;
            var flowPace = Mathf.Lerp(.85f, 1.18f, SkillFlow);
            var overdrive = OverdriveActive ? 1.22f : 1f;
            var rawSpeed = Mathf.Min(maxSpeed * overdrive, (baseSpeed + DurationSeconds * speedGainPerSecond * flowPace) * overdrive);
            CurrentSpeed = RushCityLiveOpsConfig.Instance ? RushCityLiveOpsConfig.Instance.Speed(rawSpeed) : rawSpeed;
            DistanceMeters += CurrentSpeed * Time.deltaTime;

            var baseScore = Mathf.RoundToInt(DistanceMeters * 10f) + ZqCollected * 25 * Combo + _bonusScore;
            var dangerBonus = Mathf.RoundToInt(ChasePressure * 200f * Mathf.Max(1, Combo));
            var calculated = (baseScore + dangerBonus) * ScoreMultiplier;
            Score = Mathf.Max(Score, RushCityLiveOpsConfig.Instance ? RushCityLiveOpsConfig.Instance.Score(calculated) : calculated);

            var rawChaseGain=chasePressureGain * Mathf.Lerp(1.08f,.82f,SkillFlow);
            var chaseGain=RushCityLiveOpsConfig.Instance ? RushCityLiveOpsConfig.Instance.Chase(rawChaseGain) : rawChaseGain;
            ChasePressure = Mathf.Clamp01(ChasePressure + chaseGain * Time.deltaTime);
            if (Time.time - _lastCollectTime < 0.75f) ChasePressure = Mathf.Clamp01(ChasePressure - chasePressureRecovery * Time.deltaTime);

            if (Time.time - _lastCollectTime > 2.4f) Combo = 1;
            RushCityMissionDirector.Instance?.OnDistance(DistanceMeters);
            RushCityMissionDirector.Instance?.OnSurvival(DurationSeconds);
            if (ChasePressure >= 1f) EndRun("chase-caught");
        }

        public void BeginRun()
        {
            SessionId = Guid.NewGuid().ToString("N");
            IsRunning = true; CurrentSpeed = baseSpeed; DistanceMeters = 0; DurationSeconds = 0; ChasePressure = .15f; SkillFlow = .25f;
            ZqCollected = 0; Score = 0; Combo = 1; _bonusScore = 0; _bonusZq = 0; _shieldCharges = 0;
            _magnetUntil = _overdriveUntil = _multiplierUntil = -1f; _lastCollectTime = -99f; Time.timeScale = 1f;
            RushCityGhostRecorder.Instance?.ResetRecording();
            RushCityMissionDirector.Instance?.BeginSession(SessionId);
        }

        public void CollectZq(int amount)
        {
            if (!IsRunning || amount <= 0) return;
            var chained = Time.time - _lastCollectTime <= 1.05f;
            Combo = chained ? Mathf.Min(10, Combo + 1) : 1; _lastCollectTime = Time.time; ZqCollected += amount;
            SkillFlow = Mathf.Clamp01(SkillFlow + .008f * amount); ChasePressure = Mathf.Max(0f, ChasePressure - .025f * amount);
            RushCityMissionDirector.Instance?.OnZq(amount);
        }

        public void RegisterCleanParkour()
        {
            if (!IsRunning) return;
            Combo = Mathf.Min(10, Combo + 1); SkillFlow = Mathf.Clamp01(SkillFlow + .055f);
            Score += 150 * Combo * ScoreMultiplier; ChasePressure = Mathf.Max(0f, ChasePressure - .08f);
            RushCityMissionDirector.Instance?.OnParkour();
        }

        public void RegisterNearMiss()
        {
            if (!IsRunning) return;
            Combo = Mathf.Min(10, Combo + 1); SkillFlow = Mathf.Clamp01(SkillFlow + .035f);
            Score += 220 * Combo * ScoreMultiplier; ChasePressure = Mathf.Max(0f, ChasePressure - .045f);
            RushCityMissionDirector.Instance?.OnNearMiss(); RushCityTelemetry.Instance?.NearMiss();
        }

        public void HitObstacle(float severity = .28f)
        {
            if (!IsRunning) return;
            if (TryConsumeShield()) { ChasePressure = Mathf.Max(0f, ChasePressure - .05f); return; }
            Combo = 1; SkillFlow = Mathf.Clamp01(SkillFlow - .18f);
            ChasePressure = Mathf.Clamp01(ChasePressure + Mathf.Max(.1f, severity)); Score = Mathf.Max(0, Score - 250);
            RushCityTelemetry.Instance?.Hit(); if (ChasePressure >= .98f) EndRun("impact");
        }

        public void ActivatePowerUp(RushPowerUpType type, float duration)
        {
            if (!IsRunning) return;
            duration = Mathf.Clamp(duration, 3f, 18f);
            switch(type)
            {
                case RushPowerUpType.Magnet: _magnetUntil = Mathf.Max(_magnetUntil,Time.time+duration); break;
                case RushPowerUpType.Shield: _shieldCharges = Mathf.Min(3,_shieldCharges+1); break;
                case RushPowerUpType.Overdrive: _overdriveUntil = Mathf.Max(_overdriveUntil,Time.time+duration); break;
                case RushPowerUpType.Multiplier: _multiplierUntil = Mathf.Max(_multiplierUntil,Time.time+duration); break;
            }
            Score += 180;
        }

        public bool TryConsumeShield(){if (_shieldCharges <= 0) return false; _shieldCharges--; return true;}

        public void GrantMissionReward(int rewardScore,int rewardZq,string mission)
        {
            if(!IsRunning)return;
            _bonusScore += Mathf.Max(0,rewardScore); _bonusZq += Mathf.Max(0,rewardZq); Score += Mathf.Max(0,rewardScore);
            Debug.Log($"[Rush City] mission complete {mission}: +{rewardScore} score +{rewardZq} ZQ");
        }

        public void EndRun(string reason)
        {
            if (!IsRunning) return;
            IsRunning = false; CurrentSpeed = 0;
            var totalZq = ZqCollected + _bonusZq;
            var result = new GameRunResult { sessionId = SessionId, score = Score, zqCollected = totalZq, distanceMeters = DistanceMeters, durationSeconds = DurationSeconds };
            RushCityGhostRaceManager.Instance?.FinishAndStoreCurrentRun();
            Debug.Log($"[Rush City] run ended: {reason} telemetry={RushCityTelemetry.Instance?.SnapshotJson()}");
            ZoryqPlayBridge.ReportAndReturn(result);
        }

        void OnGUI()
        {
            var scale = Mathf.Max(1f, Screen.width / 1080f); GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1));
            GUI.Box(new Rect(22, 22, 350, 176), "ZORYQ PLAY / RUSH CITY DEV HUD");
            GUI.Label(new Rect(40, 54, 315, 28), $"DIST {DistanceMeters:0}m  SPEED {CurrentSpeed:0.0}");
            GUI.Label(new Rect(40, 82, 315, 28), $"ZQ {ZqCollected + _bonusZq}  COMBO x{Combo}  SCORE x{ScoreMultiplier}");
            GUI.Label(new Rect(40, 110, 315, 28), $"CHASE {ChasePressure * 100:0}%  FLOW {SkillFlow * 100:0}%");
            GUI.Label(new Rect(40, 138, 315, 28), $"MAG {(MagnetActive?"ON":"-")} SHIELD {_shieldCharges} BOOST {(OverdriveActive?"ON":"-")}");
            if(RushCityLiveOpsConfig.Instance)GUI.Label(new Rect(40,166,315,28),$"SEASON {RushCityLiveOpsConfig.Instance.Current.seasonId}");
        }
    }
}
