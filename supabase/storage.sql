insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('goove-images','goove-images',true,5242880,array['image/jpeg','image/png','image/webp']);
-- Uploads use short-lived signed URLs issued by the authenticated owner endpoint.
-- No public INSERT, UPDATE or DELETE policy is granted.
