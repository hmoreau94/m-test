// m-test.js — Adagio measurement test build (hardcoded ctx, no fragment needed)
(function(){try{
  var T0=Date.now();
  var WH='https://webhook.site/cabcf387-24cf-45cb-a2dc-0698c796baee';

  // Try fragment first; fall back to hardcoded defaults so a bare URL still works.
  var ctx={v:'2',auction_id:'dt-webview-test',bid_id:'b1',org_id:'1608',
    bidder:'pubmatic',seat_id:'6',mt:'ban',pltfrm:'app',site:'com-belkagames-mc',
    adu_code:'1',integ:'ortb',instl:'0',decl_omid:''};
  try{
    var src=(document.currentScript||{}).src||'';
    var h=src.indexOf('#');
    if(h!==-1){src.substring(h+1).split('&').forEach(function(p){var kv=p.split('=');if(kv[0])ctx[kv[0]]=decodeURIComponent(kv[1]||'');});}
  }catch(_){}

  function px(evt,val){try{new Image().src=WH+'?evt='+encodeURIComponent(evt)+'&val='+encodeURIComponent(val||'')+'&t='+(Date.now()-T0)+'&aid='+encodeURIComponent(ctx.auction_id||'');}catch(_){}}

  px('load','');

  var env='dom',hasMRAID=false,mraidVer=null,hasOMID=false;
  try{if(typeof window.omid3p!=='undefined'||(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.omidBridge)||typeof window.omidBridge!=='undefined'){hasOMID=true;env='omid';}}catch(_){}
  try{if(typeof window.mraid!=='undefined'){hasMRAID=true;mraidVer=mraid.getVersion?mraid.getVersion():'2.0';if(!hasOMID)env=parseFloat(mraidVer)>=3?'mraid3':'mraid2';}}catch(_){}
  px('env',env);
  px('has_mraid',hasMRAID?'1':'0');
  px('has_omid',hasOMID?'1':'0');

  try{px('screen',screen.width+'x'+screen.height);}catch(_){}
  try{px('dpr',String(window.devicePixelRatio||''));}catch(_){}
  try{px('touch',('ontouchstart'in window||navigator.maxTouchPoints>0)?'1':'0');}catch(_){}
  try{px('ua',navigator.userAgent.substring(0,80));}catch(_){}

  if(hasMRAID){try{
    px('mraid_ver',mraidVer);
    try{px('mraid_plcmt',mraid.getPlacementType());}catch(_){}
    try{px('mraid_state',mraid.getState());}catch(_){}
    try{var s=mraid.getScreenSize();px('mraid_scr',s.width+'x'+s.height);}catch(_){}
    if(parseFloat(mraidVer)>=3){try{var me=window.MRAID_ENV;if(me){px('mraid_sdk',(me.sdk||'')+'/'+(me.sdkVersion||''));px('mraid_appid',me.appId||'');}}catch(_){}}
    function onReady(){
      if(parseFloat(mraidVer)>=3){try{mraid.addEventListener('exposureChange',function(p){px('expo',Math.round(p*100)/100);});}catch(_){}}
      else{try{px('mraid_vis',mraid.isViewable()?'1':'0');mraid.addEventListener('viewableChange',function(v){px('mraid_vis',v?'1':'0');});}catch(_){}}
    }
    if(mraid.getState()==='loading'){mraid.addEventListener('ready',onReady);}else{onReady();}
  }catch(e){px('mraid_err',(e.message||'').substring(0,60));}}

  try{if(typeof IntersectionObserver!=='undefined'){new IntersectionObserver(function(es){px('io',String(Math.round(es[es.length-1].intersectionRatio*100)/100));},{threshold:[0,0.5,1]}).observe(document.documentElement||document.body);}else{px('io_fallback','1');}}catch(e){px('io_err',(e.message||'').substring(0,60));}

  try{px('vis',document.visibilityState==='visible'?'1':'0');}catch(_){}
  try{document.addEventListener('touchstart',function(){px('touch_int','1');},{passive:true,once:true});}catch(_){}

  if(hasOMID){try{var os=document.createElement('script');os.src='https://c.4dex.tech/omid-client.js';os.onerror=function(){px('omid_err','client_load_failed');};document.head.appendChild(os);}catch(e){px('omid_err',(e.message||'').substring(0,60));}}

  px('setup_done','');
}catch(e){try{new Image().src='https://webhook.site/cabcf387-24cf-45cb-a2dc-0698c796baee?evt=fatal&val='+encodeURIComponent((e.message||'').substring(0,80));}catch(_){}}})();
