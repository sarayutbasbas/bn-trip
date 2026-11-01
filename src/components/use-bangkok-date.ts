"use client";
import { useEffect, useState } from "react";
import { bangkokDate } from "@/src/lib/accommodation-payment";

export function useBangkokDate() {
  const [today,setToday]=useState(()=>bangkokDate());
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    const update=()=>{
      clearTimeout(timer);setToday(bangkokDate());
      const thaiTime=Date.now()+7*60*60*1000;
      timer=setTimeout(update,86400000-thaiTime%86400000+100);
    };
    update();window.addEventListener("focus",update);document.addEventListener("visibilitychange",update);
    return()=>{clearTimeout(timer);window.removeEventListener("focus",update);document.removeEventListener("visibilitychange",update);};
  },[]);
  return today;
}
