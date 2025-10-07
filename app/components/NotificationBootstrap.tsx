import React, { useEffect } from 'react';
import { initializeNotifications } from '@/src/services/notifications';

export default function NotificationBootstrap(){
  useEffect(()=>{
    let mounted = true;
    let cleanup: (()=>void)|undefined;
    (async()=>{
      const fn = await initializeNotifications(20, 15);
      if(mounted){
        cleanup = fn;
      } else if (typeof fn === 'function') {
        fn();
      }
    })();
    return ()=>{
      mounted = false;
      if(typeof cleanup === 'function') cleanup();
    };
  },[]);
  return null;
}


