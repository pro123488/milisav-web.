// Shader unlit para el mundo de voxeles, los mobs y los objetos.
// Funciona en Built-in RP y en URP (pase sin LightMode => SRPDefaultUnlit).
// Luz por vertice: uv2.x = luz del cielo (0..1), uv2.y = luz de bloque (0..1).
// Color por vertice: rgb = tinte de bioma * sombreado/AO, a = opacidad.
Shader "MundoBloques/Voxel"
{
    Properties
    {
        _MainTex ("Atlas", 2D) = "white" {}
        _Cutoff ("Alpha cutoff", Range(0,1)) = 0.5
        _Tint ("Tint", Color) = (1,1,1,1)
        _ObjLight ("Luz del objeto (-1 = por vertice)", Float) = -1
        [Enum(UnityEngine.Rendering.CullMode)] _Cull ("Cull", Float) = 2
        [Enum(UnityEngine.Rendering.BlendMode)] _SrcBlend ("Src", Float) = 1
        [Enum(UnityEngine.Rendering.BlendMode)] _DstBlend ("Dst", Float) = 0
        _ZWrite ("ZWrite", Float) = 1
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        Pass
        {
            Cull [_Cull]
            ZWrite [_ZWrite]
            Blend [_SrcBlend] [_DstBlend]

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed _Cutoff;
            fixed4 _Tint;
            float _ObjLight;

            // Globales (las fija DayNight)
            float _MB_Sky;
            float _MB_Ambient;
            fixed4 _MB_Fog;
            float _MB_FogStart;
            float _MB_FogEnd;

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
                float2 uv2 : TEXCOORD1;
                fixed4 color : COLOR;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
                fixed4 col : COLOR;
                float fog : TEXCOORD1;
            };

            v2f vert(appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                float l = _ObjLight >= 0 ? _ObjLight : max(v.uv2.x * _MB_Sky, v.uv2.y);
                l = saturate(l);
                l = _MB_Ambient + (1.0 - _MB_Ambient) * pow(l, 1.6);
                o.col = fixed4(v.color.rgb * l, v.color.a);
                float3 vp = UnityObjectToViewPos(v.vertex);
                float d = length(vp);
                o.fog = saturate((d - _MB_FogStart) / max(0.001, _MB_FogEnd - _MB_FogStart));
                return o;
            }

            fixed4 frag(v2f i) : SV_Target
            {
                fixed4 c = tex2D(_MainTex, i.uv) * i.col * _Tint;
                clip(c.a - _Cutoff);
                c.rgb = lerp(c.rgb, _MB_Fog.rgb, i.fog);
                return c;
            }
            ENDCG
        }
    }
    Fallback Off
}
