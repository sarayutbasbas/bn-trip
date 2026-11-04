// Inline in <head> so the first streamed frame already has its launch styling.
export const appLaunchStyle = `
.app-launch-screen{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-height:100dvh;box-sizing:border-box;padding:max(32px,env(safe-area-inset-top)) 28px max(24px,env(safe-area-inset-bottom));background:#fff7f0;color:#452713;opacity:1;transition:opacity .22s ease;isolation:isolate;font-family:"IBM Plex Sans Thai",sans-serif}
.app-launch-screen.is-leaving{opacity:0;pointer-events:none}
body:has(.app-launch-screen){overflow:hidden;overscroll-behavior:none}
.app-launch-brand{display:flex;align-items:center;gap:10px;flex-shrink:0}
.app-launch-brand img{object-fit:contain}.app-launch-brand span{font-size:25px;font-weight:700;line-height:1.25;letter-spacing:-.6px}
.app-launch-brand small{display:block;font-size:8px;font-weight:600;letter-spacing:1.8px;color:#e56216;margin-top:4px}
.app-launch-center{width:min(100%,330px);text-align:center;margin:auto 0}
.app-launch-art{display:block;width:min(100%,300px,38dvh);height:auto;aspect-ratio:1;object-fit:contain;margin:0 auto 12px;mix-blend-mode:multiply}
.app-launch-center h1{font-size:24px;line-height:1.6;letter-spacing:-.5px;margin:0;font-weight:700;color:#452713}
.app-launch-center p{font-size:13px;line-height:1.7;margin:4px 0 30px;color:#936f54}
.app-launch-progress-copy{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#936f54;margin-bottom:9px}
.app-launch-progress-copy strong{font-size:18px;font-variant-numeric:tabular-nums;color:#eb6613}
.app-launch-progress-copy>span{display:flex;align-items:center;gap:7px}.app-launch-progress-copy i{width:12px;height:12px;border:2px solid #f3d7c1;border-top-color:#eb6613;border-radius:50%;animation:app-launch-spin .85s linear infinite}
@keyframes app-launch-spin{to{transform:rotate(360deg)}}
.app-launch-progress{height:6px;border-radius:20px;background:#f3e3d6;overflow:hidden}
.app-launch-progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ff5b0a,#ffa126);transition:width .12s linear}
.app-launch-footer{font-size:9px;letter-spacing:2.5px;color:#ae8565;margin-top:24px}
@media(max-height:520px){.app-launch-screen{padding-top:12px;padding-bottom:12px}.app-launch-art{width:24dvh;margin-bottom:0}.app-launch-center p{margin-bottom:12px}.app-launch-footer{margin-top:12px}.app-launch-center h1{font-size:20px}}
@media(prefers-reduced-motion:reduce){.app-launch-screen,.app-launch-progress>span{transition:none}.app-launch-progress-copy i{animation:none}}
`;
