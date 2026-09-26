-- Las fotos de evidencia no son sensibles: se hace público el bucket para
-- servir con getPublicUrl (sin round-trip de createSignedUrls y cacheable
-- por el navegador) en vez de URLs firmadas de 10 minutos.
update storage.buckets set public = true where id = 'evidencias';
