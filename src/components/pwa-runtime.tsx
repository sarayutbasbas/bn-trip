"use client";

import { useEffect, useState } from "react";
import { getCurrentAccount } from "@/src/lib/client-account";

export function PwaRuntime(){
  const [offline,setOffline]=useState(false);
  useEffect(()=>{if("serviceWorker" in navigator)void navigator.serviceWorker.register("/sw.js");void getCurrentAccount().then(async account=>{const previous=localStorage.getItem("bn-trip-offline-user-id");if(previous&&previous!==account.id)await clearPrivateOfflineData();localStorage.setItem("bn-trip-offline-user-id",account.id)}).catch(()=>{});const update=()=>setOffline(!navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update)}},[]);
  return offline?<div className="offline-status" role="status">ออฟไลน์ · กำลังแสดงข้อมูลที่บันทึกไว้</div>:null;
}

export async function clearPrivateOfflineData(){
  if("caches" in window){const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith("bn-trip-private-")).map(name=>caches.delete(name)))}
  Object.keys(localStorage).filter(key=>key.startsWith("bn-trip-offline-")).forEach(key=>localStorage.removeItem(key));
  localStorage.removeItem("bn-trip-offline-user-id");
  navigator.serviceWorker?.controller?.postMessage({type:"CLEAR_PRIVATE_DATA"});
}

export async function clearOfflineDocuments(){
  if("caches" in window)await caches.delete("bn-trip-private-documents-v1");
  Object.keys(localStorage)
    .filter(key=>key.startsWith("bn-trip-offline-documents:"))
    .forEach(key=>localStorage.removeItem(key));
  navigator.serviceWorker?.controller?.postMessage({type:"CLEAR_OFFLINE_DOCUMENTS"});
}
