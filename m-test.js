// m-test.js — Adagio measurement script test build
// Beacons every signal to webhook.site for DT WebView validation
// Context read from URL fragment: m-test.js#v=2&auction_id=X&bid_id=Y&...
(function(){try{
  var T0=Date.now();
  var WH='https://webhook.site/cabcf387-24cf-45cb-a2dc-0698c796baee';

  // Read context from URL fragment (real prod mechanism via document.currentScript)
  var ctx={};
  try{
    var src=(document.currentScript||{}).src||'';
    var h=src.indexOf('#');
    if(h!==-1){src.substring(h+1).split('&').forEach(function(p){var kv=p.split('=');ctx[kv[0]]=decodeURIComponent(kv[1]||'');});}
  }catch(_){}

  function px(evt,val){
    try{new Image().src=WH+'?evt='+encodeURIComponent(evt)+'&val='+encodeURIComponent(val||'')+'&t='+(Date.now()-T0)+'&aid='+(ctx.auction_id||'');}catch(_){}
  }

  px('load','');

  // Environment detection
  var env='dom',hasMRAID=false,mraidVer=null,hasOMID=false;
  try{if(typeof window.omid3p!=='undefined'||(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.omidBridge)||typeof window.omidBridge!=='undefined'){hasOMID=true;env='omid';}}catch(_){}
  try{if(typeof window.mraid!=='undefined'){hasMRAID=true;mraidVer=mraid.getVersion?mraid.getVersion():'2.0';if(!hasOMID)env=parseFloat(mraidVer)>=3?'mraid3':'mraid2';}}catch(_){}
  px('env',env);

  // Device signals
  try{px('screen',screen.width+'x'+screen.height);}catch(_){}
  try{px('dpr',String(window.devicePixelRatio||''));}catch(_){}
  try{px('touch',('ontouchstart'in window||navigator.maxTouchPoints>0)?'1':'0');}catch(_){}
  try{px('cores',String(navigator.hardwareConcurrency||''));}catch(_){}
  try{px('ua',navigator.userAgent.substring(0,80));}catch(_){}

  // MRAID tier
  if(hasMRAID){try{
    px('mraid_ver',mraidVer);
    try{px('mraid_plcmt',mraid.getPlacementType());}catch(_){}
    try{px('mraid_state',mraid.getState());}catch(_){}
    try{var ms=mraid.getMaxSize();px('mraid_maxsz',ms.width+'x'+ms.height);}catch(_){}
    try{var mp=mraid.getCurrentPosition();px('mraid_pos',mp.x+','+mp.y+','+mp.width+','+mp.height);}catch(_){}
    try{var msc=mraid.getScreenSize();px('mraid_scr',msc.width+'x'+msc.height);}catch(_){}
    var ft=[];['sms','tel','calendar','storePicture','inlineVideo','location'].forEach(function(f){try{if(mraid.supports(f))ft.push(f);}catch(_){}});
    if(ft.length)px('mraid_feat',ft.join(','));
    if(parseFloat(mraidVer)>=3){
      try{var me=window.MRAID_ENV;if(me){px('mraid_sdk',(me.sdk||'')+'/'+(me.sdkVersion||''));px('mraid_appid',me.appId||'');}}catch(_){}
      try{var mo=mraid.getCurrentAppOrientation();px('mraid_orient',mo.orientation+(mo.locked?',locked':''));}catch(_){}
    }
    function onReady(){
      if(parseFloat(mraidVer)>=3){
        try{mraid.addEventListener('exposureChange',function(p,vr,oc){px('expo',Math.round(p*100)/100+','+(oc&&oc.length?oc.length:'0'));});}catch(_){}
      }else{
        try{px('mraid_vis',mraid.isViewable()?'1':'0');mraid.addEventListener('viewableChange',function(v){px('mraid_vis',v?'1':'0');});}catch(_){}
      }
      try{mraid.addEventListener('stateChange',function(s){px('mraid_st_chg',s);});}catch(_){}
    }
    if(mraid.getState()==='loading'){mraid.addEventListener('ready',onReady);}else{onReady();}
  }catch(e){px('mraid_err',(e.message||'').substring(0,60));}}

  // IntersectionObserver
  try{
    if(typeof IntersectionObserver!=='undefined'){
      new IntersectionObserver(function(es){var r=Math.round(es[es.length-1].intersectionRatio*100)/100;px('io',String(r));},{threshold:[0,0.01,0.5,1.0]}).observe(document.documentElement||document.body);
    }else{px('io_fallback','1');}
  }catch(e){px('io_err',(e.message||'').substring(0,60));}

  // Visibility
  try{px('vis',document.visibilityState==='visible'?'1':'0');document.addEventListener('visibilitychange',function(){px('vis',document.visibilityState==='visible'?'1':'0');});}catch(_){}

  // Touch interaction
  try{document.addEventListener('touchstart',function(){px('touch_int','1');},{passive:true,once:true});}catch(_){}

  // OMID
  px('omid_bridge',hasOMID?'1':'0');
  if(hasOMID){
    try{
      var os=document.createElement('script');
      os.src='https://c.4dex.tech/omid-client.js';
      os.onerror=function(){px('omid_err','client_load_failed');};
      document.head.appendChild(os);
    }catch(e){px('omid_err',(e.message||'').substring(0,60));}
  }

  // Final beacon on unload
  var done=false;
  function onFinal(r){if(done)return;done=true;px('end',r);}
  try{window.addEventListener('pagehide',function(){onFinal('pagehide');});}catch(_){}

  px('setup_done','');
}catch(e){try{new Image().src='https://webhook.site/cabcf387-24cf-45cb-a2dc-0698c796baee?evt=fatal&val='+encodeURIComponent((e.message||'').substring(0,80));}catch(_){}}})();
