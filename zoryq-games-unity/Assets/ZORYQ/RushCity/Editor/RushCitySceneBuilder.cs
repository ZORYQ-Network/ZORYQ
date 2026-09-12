#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Zoryq.Play.RushCity.Editor
{
    public static class RushCitySceneBuilder
    {
        const string ScenePath="Assets/ZORYQ/RushCity/Scenes/RushCityVerticalSlice.unity";

        [MenuItem("ZORYQ/Rush City/Build Vertical Slice Scene")]
        public static void Build()
        {
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            RenderSettings.fog=true; RenderSettings.fogColor=new Color(.012f,.018f,.045f); RenderSettings.fogDensity=.012f;
            RenderSettings.ambientLight=new Color(.08f,.09f,.18f);

            var lightGo=new GameObject("Moon Key Light"); var light=lightGo.AddComponent<Light>(); light.type=LightType.Directional; light.intensity=1.15f; light.color=new Color(.58f,.72f,1f); lightGo.transform.rotation=Quaternion.Euler(42,-24,0);

            new GameObject("AdaptiveQuality").AddComponent<RushCityQualityManager>();
            new GameObject("Telemetry").AddComponent<RushCityTelemetry>();
            new GameObject("MissionDirector").AddComponent<RushCityMissionDirector>();
            new GameObject("RushCityGameManager").AddComponent<RushCityGameManager>();

            var player=GameObject.CreatePrimitive(PrimitiveType.Capsule); player.name="Runner_EngineeringRig"; player.transform.position=new Vector3(0,1,2);
            Object.DestroyImmediate(player.GetComponent<CapsuleCollider>());
            var cc=player.AddComponent<CharacterController>(); cc.height=1.9f; cc.radius=.42f; cc.center=new Vector3(0,.95f,0);
            player.AddComponent<RushCityPlayerController>();
            var playerMat=NewMat(new Color(.12f,.3f,1f),2.6f); player.GetComponent<Renderer>().sharedMaterial=playerMat;

            var camGo=new GameObject("RushCamera"); camGo.tag="MainCamera"; var cam=camGo.AddComponent<Camera>(); cam.clearFlags=CameraClearFlags.SolidColor; cam.backgroundColor=new Color(.006f,.008f,.02f); cam.nearClipPlane=.05f; cam.farClipPlane=450f;
            var follow=camGo.AddComponent<RushCityCameraController>(); follow.target=player.transform; camGo.transform.position=new Vector3(0,3.2f,-5.5f);

            var trackGo=new GameObject("ProceduralTrack"); var track=trackGo.AddComponent<RushCityTrackManager>(); track.player=player.transform;
            var cityGo=new GameObject("LivingCity"); var city=cityGo.AddComponent<RushCityProceduralCity>(); city.player=player.transform;

            var chaseRoot=new GameObject("ChaseSystem");
            var drone=GameObject.CreatePrimitive(PrimitiveType.Sphere); drone.name="ChaseDrone_EngineeringRig"; drone.transform.SetParent(chaseRoot.transform); drone.transform.localScale=new Vector3(1.1f,.42f,1.6f); drone.GetComponent<Renderer>().sharedMaterial=NewMat(new Color(1f,.04f,.18f),3.4f); Object.DestroyImmediate(drone.GetComponent<SphereCollider>());
            var warningGo=new GameObject("ChaseWarningLight"); warningGo.transform.SetParent(drone.transform); var warning=warningGo.AddComponent<Light>(); warning.type=LightType.Point; warning.range=12; warning.color=new Color(1f,.04f,.18f); warning.intensity=2f;
            chaseRoot.AddComponent<RushCityChaseDirector>().Configure(player.transform,drone.transform,warning);

            var glow=new GameObject("NeonFill").AddComponent<Light>(); glow.type=LightType.Point; glow.range=26; glow.intensity=7; glow.color=new Color(.35f,.08f,1f); glow.transform.position=new Vector3(0,4,8);

            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            EditorSceneManager.SaveScene(scene,ScenePath);
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(ScenePath,true)};
            Selection.activeGameObject=player;
            Debug.Log("[ZORYQ] Rush City systems-complete vertical slice scene generated. Replace EngineeringRig meshes during final art pass.");
        }

        static Material NewMat(Color c,float e){var s=Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard");var m=new Material(s);m.color=c;m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",c*e);return m;}
    }
}
#endif
