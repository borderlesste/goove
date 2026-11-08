import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTranslations } from '../supabase/functions/_shared/translations.ts';
test('owner translations are limited to supported languages, fields and bounded plain text',()=>{
 const fields={name:100,description:500};
 assert.deepEqual(validateTranslations({fr:{name:'  Sac  ',description:''},ht:{description:'Valiz'}},fields),{fr:{name:'Sac'},ht:{description:'Valiz'}});
 for(const input of [null,[],{de:{name:'Bag'}},{fr:[]},{fr:{name:3}},{fr:{name:'a'.repeat(101)}},{fr:{image_url:'https://test'}}])assert.throws(()=>validateTranslations(input,fields));
 assert.deepEqual(validateTranslations({},fields),{});
});
