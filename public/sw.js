const STATIC_CACHE="pack-and-go-static-v3";
const PRIVATE_DATA_CACHE="bn-trip-private-data-v1";
const PRIVATE_DOCUMENT_CACHE="bn-trip-private-documents-v1";
const STATIC_ASSETS=["/manifest.webmanifest","/pack-and-go-icon-192.png","/pack-and-go-icon-512.png","/apple-touch-icon-pack-and-go.png","/travel-postcard-fallback.jpg"];

self.addEventListener("install",event=>{event.waitUntil(caches.open(STATIC_CACHE).then(cache=>cache.addAll(STATIC_ASSETS)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(Promise.all([caches.keys().then(names=>Promise.all(names.filter(name=>(name.startsWith("bn-trip-static-")||name.startsWith("pack-and-go-static-"))&&name!==STATIC_CACHE).map(name=>caches.delete(name)))),self.clients.claim()]))});
self.addEventListener("message",event=>{if(event.data?.type==="CLEAR_PRIVATE_DATA")event.waitUntil(Promise.all([caches.delete(PRIVATE_DATA_CACHE),caches.delete(PRIVATE_DOCUMENT_CACHE)]));else if(event.data?.type==="CLEAR_OFFLINE_DOCUMENTS")event.waitUntil(caches.delete(PRIVATE_DOCUMENT_CACHE))});

async function networkFirst(request,cacheName){const cache=await caches.open(cacheName);try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());else if(response.status===401||response.status===403||response.status===404)await cache.delete(request);return response}catch{const cached=await cache.match(request);return cached||new Response(JSON.stringify({error:"Offline and no saved data"}),{status:503,headers:{"Content-Type":"application/json"}})}}
async function privateDocument(request){const cache=await caches.open(PRIVATE_DOCUMENT_CACHE);const cached=await cache.match(request);if(cached)return cached;try{const response=await fetch(request);if(response.status===401||response.status===403||response.status===404)await cache.delete(request);return response}catch{return new Response("Document is not saved offline",{status:503})}}
self.addEventListener("fetch",event=>{const request=event.request;if(request.method!=="GET")return;const url=new URL(request.url);if(url.origin!==location.origin)return;
  if(url.pathname.includes("/documents/")&&url.pathname.endsWith("/file")){event.respondWith(privateDocument(request));return}
  if(/^\/api\/trips(?:\/|$)/.test(url.pathname)){event.respondWith(networkFirst(request,PRIVATE_DATA_CACHE));return}
  if(request.mode==="navigate"){event.respondWith(networkFirst(request,PRIVATE_DATA_CACHE));return}
  if(url.pathname.startsWith("/_next/static/")||url.pathname.startsWith("/flags/")||STATIC_ASSETS.includes(url.pathname)){event.respondWith(caches.open(STATIC_CACHE).then(async cache=>(await cache.match(request))||fetch(request).then(response=>{if(response.ok)void cache.put(request,response.clone());return response})));}
});
