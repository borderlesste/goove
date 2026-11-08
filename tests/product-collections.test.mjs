import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {productFields} from '../supabase/functions/_shared/product.ts';
import {featuredProducts,collectionProducts} from '../src/catalog.js';
import {productLink,readProductTarget} from '../src/productLinks.js';

test('collections and home curation use explicit placement rather than product creation',()=>{
 const items=[{id:'old'},{id:'bag',category:'handbag',featured:true},{id:'women',category:'watch',audience:'women'},{id:'men',category:'watch',audience:'men',featured:true}];
 assert.deepEqual(featuredProducts(items).map(p=>p.id),['bag','men']);
 assert.deepEqual(collectionProducts(items,'watch','women').map(p=>p.id),['women']);
 assert.deepEqual(collectionProducts(items,'watch','men').map(p=>p.id),['men']);
 assert.deepEqual(collectionProducts(items,'handbag').map(p=>p.id),['old','bag']);
 assert.deepEqual(productFields({category:'watch',audience:'men',featured:false}),{category:'watch',audience:'men',featured:false});
 assert.deepEqual(productFields({name:'Older client'}),{});
 for(const item of [{category:'gift'},{category:['watch']},{audience:'unknown'},{audience:[]},{featured:'false'}])assert.throws(()=>productFields(item));
 const href=productLink('watch-example',2,'watch');assert.equal(new URL(href).pathname,'/watches');assert.deepEqual(readProductTarget(href),{id:'watch-example',photoIndex:2,open:true});
});
test('product collection migration preserves products and selections while new items default off home',async()=>{
 const db=new PGlite();
 await db.exec("create table handbags(id int primary key,display_order int,created_at timestamptz default now(),name text); create table goove_settings(hero_description text,promo_banner_text text); insert into goove_settings values ('Custom owner copy','Custom flag');");
 await db.exec("insert into handbags(id,display_order,name) select i,i,'Product '||i from generate_series(1,9) i;");
 const dir=new URL('../supabase/migrations/',import.meta.url),file=(await readdir(dir)).find(n=>n.endsWith('_add_product_collections.sql'));
 const sql=await readFile(new URL(file,dir),'utf8');await db.exec(sql);
 assert.equal((await db.query('select count(*)::int n from handbags where featured')).rows[0].n,6);
 await db.exec("update handbags set featured=false where id=1; insert into handbags(id,display_order,name,category,audience) values(10,0,'New watch','watch','women');");
 await db.exec(sql);
 const watch=(await db.query('select featured,category,audience from handbags where id=10')).rows[0];assert.deepEqual(watch,{featured:false,category:'watch',audience:'women'});
 assert.equal((await db.query('select count(*)::int n from handbags')).rows[0].n,10);
 assert.equal((await db.query('select featured from handbags where id=1')).rows[0].featured,false);
 assert.equal((await db.query('select hero_description from goove_settings')).rows[0].hero_description,'Custom owner copy');
 await assert.rejects(db.exec("update handbags set category='gift' where id=10"),/check constraint/);
 await db.close();
});
