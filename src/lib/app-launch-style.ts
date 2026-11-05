// Inline in <head> so the first streamed frame already has its launch styling.
export const appLaunchStyle = `
.app-launch-screen{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;min-height:100dvh;box-sizing:border-box;padding:max(32px,env(safe-area-inset-top)) 28px max(24px,env(safe-area-inset-bottom));background:#fff7f0;color:#fff;opacity:1;transition:opacity .22s ease;isolation:isolate;font-family:"IBM Plex Sans Thai",sans-serif;overflow:hidden}
.app-launch-art{position:absolute;inset:0;z-index:0;display:block;width:100%;height:100%;object-fit:cover;object-position:center}
.app-launch-screen::before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(255,247,240,.85),rgba(255,247,240,0) 30%,rgba(45,24,10,0) 35%,rgba(45,24,10,.94) 100%);pointer-events:none}
.app-launch-screen.is-leaving{opacity:0;pointer-events:none}
body:has(.app-launch-screen){overflow:hidden;overscroll-behavior:none}
.app-launch-brand,.app-launch-center,.app-launch-footer{position:relative;z-index:2}
.app-launch-brand{display:flex;align-items:center;gap:10px;flex-shrink:0;color:#452713}
.app-launch-brand img{object-fit:contain}.app-launch-brand span{font-size:25px;font-weight:700;line-height:1.25;letter-spacing:-.6px}
.app-launch-brand small{display:block;font-size:8px;font-weight:600;letter-spacing:1.8px;color:#b84808;margin-top:4px}
.app-launch-center{width:min(100%,420px);text-align:left;margin:auto 0 24px;padding-top:24px;text-shadow:0 2px 16px rgba(45,24,10,.18)}
.app-launch-center h1{font-size:clamp(24px,6vw,32px);line-height:1.6;letter-spacing:-.5px;margin:0;font-weight:700;color:#fff}
.app-launch-center p{font-size:13px;line-height:1.7;margin:4px 0 30px;color:rgba(255,255,255,.8)}
.app-launch-progress-copy{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:rgba(255,255,255,.85);margin-bottom:9px}
.app-launch-progress-copy strong{font-size:20px;font-variant-numeric:tabular-nums;color:#fff}
.app-launch-progress-copy>span{display:flex;align-items:center;gap:7px}.app-launch-progress-copy i{width:12px;height:12px;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:app-launch-spin .85s linear infinite}
@keyframes app-launch-spin{to{transform:rotate(360deg)}}
.app-launch-progress{height:6px;border-radius:20px;background:rgba(255,255,255,.24);overflow:hidden}
.app-launch-progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ff7412,#ffc16b);transition:width .12s linear}
.app-launch-footer{font-size:9px;letter-spacing:2.5px;color:rgba(255,255,255,.6)}
@media(max-height:520px){.app-launch-screen{padding-top:12px;padding-bottom:12px}.app-launch-center{margin-bottom:12px}.app-launch-center p{margin-bottom:12px}.app-launch-center h1{font-size:22px}}
@media(prefers-reduced-motion:reduce){.app-launch-screen,.app-launch-progress>span{transition:none}.app-launch-progress-copy i{animation:none}}
`;
