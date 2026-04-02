const CACHE='barbercash-v2';
const STATIC=['/index.html','/manifest.json','/booking.html',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  // Não intercepta Firebase/Google APIs
  if(url.hostname.includes('firebase')||url.hostname.includes('googleapis')||url.hostname.includes('gstatic')||url.hostname.includes('firestore'))return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      const net=fetch(e.request).then(r=>{
        if(r&&r.status===200&&e.request.method==='GET'){
          const clone=r.clone();
          caches.open(CACHE).then(c=>c.put(e.request,clone));
        }
        return r;
      });
      return cached||net;
    }).catch(()=>caches.match('/index.html'))
  );
});
