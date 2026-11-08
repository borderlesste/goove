-- Fill missing catalog-description translations without replacing owner-authored copy.
-- Match original descriptions so later product edits are never overwritten.

update public.handbags p
set translations = jsonb_set(jsonb_set(jsonb_set(p.translations, '{fr}', coalesce(p.translations->'fr', '{}'::jsonb) || jsonb_build_object('description', coalesce(nullif(btrim(p.translations#>>'{fr,description}'), ''), d.fr))), '{ht}', coalesce(p.translations->'ht', '{}'::jsonb) || jsonb_build_object('description', coalesce(nullif(btrim(p.translations#>>'{ht,description}'), ''), d.ht))), '{es}', coalesce(p.translations->'es', '{}'::jsonb) || jsonb_build_object('description', coalesce(nullif(btrim(p.translations#>>'{es,description}'), ''), d.es)))
from jsonb_to_recordset($copy$[
  {
    "original": "Artisanal texture, everyday elegance, made for getting away and coming home.",
    "fr": "Une texture artisanale et une élégance au quotidien, pour vos escapades comme pour vos retours à la maison.",
    "ht": "Yon teksti atizanal ak elegans pou chak jou, pou lè w ap vwayaje ak lè w ap retounen lakay.",
    "es": "Textura artesanal y elegancia cotidiana, para tus escapadas y tus regresos a casa."
  },
  {
    "original": "Polished, versatile, and quietly distinctive — a forever favorite.",
    "fr": "Raffiné, polyvalent et discrètement unique : un favori intemporel.",
    "ht": "Rafine, pratik pou plizyè okazyon, ak yon cham espesyal ki pa fè bri — yon favori pou lontan.",
    "es": "Refinado, versátil y discretamente único: un favorito para siempre."
  },
  {
    "original": "A modern classic with everyday ease and enduring appeal.",
    "fr": "Un classique moderne, pratique au quotidien et au charme durable.",
    "ht": "Yon modèl klasik modèn, fasil pou sèvi chak jou, ak yon cham ki dire.",
    "es": "Un clásico moderno, cómodo para el día a día y con un encanto duradero."
  },
  {
    "original": "Compact, considered, and always in good company.",
    "fr": "Compact, bien pensé et toujours de bonne compagnie.",
    "ht": "Konpak, byen fèt, epi toujou yon bon konpayon.",
    "es": "Compacto, bien pensado y siempre en buena compañía."
  },
  {
    "original": "Understated and versatile, for the moments that matter most.",
    "fr": "Sobre et polyvalent, pour les moments qui comptent le plus.",
    "ht": "Senp ak rafine, adapte ak plizyè okazyon, pou moman ki pi enpòtan yo.",
    "es": "Discreto y versátil, para los momentos que más importan."
  },
  {
    "original": "Classical and refined bag for elegant with flowers 🌹",
    "fr": "Un sac classique et raffiné, orné de fleurs pour une touche d’élégance 🌹",
    "ht": "Yon valiz klasik ak rafine, dekore ak flè pou yon touche elegans 🌹",
    "es": "Un bolso clásico y refinado, decorado con flores para un toque de elegancia 🌹"
  },
  {
    "original": "Bag shoulder, multi color and easy to use",
    "fr": "Un sac à bandoulière multicolore, facile à utiliser.",
    "ht": "Yon valiz pou mete sou zepòl, ki gen plizyè koulè epi ki fasil pou sèvi.",
    "es": "Un bolso de hombro multicolor y fácil de usar."
  },
  {
    "original": "Effortless and refined, with a relaxed silhouette for wherever the day leads.",
    "fr": "Naturel et raffiné, avec une silhouette décontractée pour vous accompagner tout au long de la journée.",
    "ht": "Senp ak rafine, ak yon fòm dekontrakte pou akonpaye ou nenpòt kote jounen an mennen ou.",
    "es": "Natural y refinado, con una silueta relajada que te acompaña allá donde te lleve el día."
  },
  {
    "original": "Red panels frame a black and white plaid flap with a\nslim gold-tone bar. A rounded top handle and\nmatching long strap complete the structured shape.",
    "fr": "Des panneaux rouges encadrent un rabat à carreaux noirs et blancs, orné d’une fine barre dorée. Une anse arrondie et une longue bandoulière assortie complètent sa forme structurée.",
    "ht": "Panno wouj antoure yon rabat ak kare nwa ak blan, ki gen yon ti ba koulè lò. Yon manch won anlè ak yon senti long ki mache avè l konplete fòm byen estriktire li.",
    "es": "Paneles rojos enmarcan una solapa de cuadros blancos y negros con una fina barra dorada. Un asa superior redondeada y una correa larga a juego completan su forma estructurada."
  },
  {
    "original": "A reflective gold finish highlights the textured front\nand rounded handles of this handbag, shown with a\nmatching envelope pouch and a small tab wallet.",
    "fr": "Une finition dorée brillante met en valeur le devant texturé et les anses arrondies de ce sac, présenté avec une pochette enveloppe assortie et un petit portefeuille à patte.",
    "ht": "Yon fini koulè lò ki briye mete teksti devan an ak manch won valiz sa a an valè. Li prezante ak yon ti poche ki gen fòm anvlòp ak yon ti bous ak langèt ki mache avè l.",
    "es": "Un acabado dorado brillante resalta el frente texturizado y las asas redondeadas de este bolso, presentado con un estuche tipo sobre a juego y una pequeña cartera con lengüeta."
  },
  {
    "original": "Lavender color, a curved flap, and an oval\ngold-tone clasp distinguish this handbag. A round\nhanging charm, single arched handle, and matching\nlong strap add detail.",
    "fr": "Sa couleur lavande, son rabat incurvé et son fermoir ovale doré distinguent ce sac. Un pendentif rond, une anse arquée et une longue bandoulière assortie complètent ses détails.",
    "ht": "Koulè lavand li, rabat koube li ak fèmwa oval koulè lò li fè valiz sa a parèt espesyal. Yon ti dekorasyon won ki pandye, yon manch koube ak yon senti long ki mache avè l ajoute detay.",
    "es": "El color lavanda, la solapa curva y el cierre ovalado dorado distinguen este bolso. Un adorno redondo colgante, un asa arqueada y una correa larga a juego añaden detalle."
  },
  {
    "original": "Burgundy patterned panels contrast with black trim\nand a gold-tone animal emblem. Rounded handles\nand a long strap frame the handbag, shown with a\nred drawstring pouch.",
    "fr": "Des panneaux bordeaux à motifs contrastent avec des bordures noires et un emblème animal doré. Des anses arrondies et une longue bandoulière complètent ce sac, présenté avec une pochette rouge à cordon.",
    "ht": "Panno koulè diven ak desen fè yon bèl kontras ak rebò nwa yo ak yon anblèm bèt koulè lò. Manch won ak yon senti long konplete valiz la, ki prezante ak yon ti poche wouj ki fèmen ak kòd.",
    "es": "Paneles burdeos estampados contrastan con ribetes negros y un emblema de animal dorado. Asas redondeadas y una correa larga completan el bolso, presentado con una bolsa roja con cordón."
  }
]$copy$::jsonb) as d(original text, fr text, ht text, es text)
where p.description = d.original;

update public.gift_types p
set translations = jsonb_set(jsonb_set(jsonb_set(p.translations, '{fr}', coalesce(p.translations->'fr', '{}'::jsonb) || jsonb_build_object('description', coalesce(nullif(btrim(p.translations#>>'{fr,description}'), ''), d.fr))), '{ht}', coalesce(p.translations->'ht', '{}'::jsonb) || jsonb_build_object('description', coalesce(nullif(btrim(p.translations#>>'{ht,description}'), ''), d.ht))), '{es}', coalesce(p.translations->'es', '{}'::jsonb) || jsonb_build_object('description', coalesce(nullif(btrim(p.translations#>>'{es,description}'), ''), d.es)))
from jsonb_to_recordset($copy$[
  {
    "original": "Enjoy 5% off your next handbag purchase.",
    "fr": "Profitez de 5 % de réduction sur votre prochain achat de sac à main.",
    "ht": "Jwenn 5% rabè sou pwochen valiz ou achte a.",
    "es": "Disfruta de un 5 % de descuento en tu próxima compra de un bolso."
  },
  {
    "original": "Receive 3% off your next handbag purchase.",
    "fr": "Bénéficiez de 3 % de réduction sur votre prochain achat de sac à main.",
    "ht": "Resevwa 3% rabè sou pwochen valiz ou achte a.",
    "es": "Recibe un 3 % de descuento en tu próxima compra de un bolso."
  },
  {
    "original": "Enjoy a special 2% discount on your next handbag purchase.",
    "fr": "Profitez d’une réduction spéciale de 2 % sur votre prochain achat de sac à main.",
    "ht": "Jwenn yon rabè espesyal 2% sou pwochen valiz ou achte a.",
    "es": "Disfruta de un descuento especial del 2 % en tu próxima compra de un bolso."
  },
  {
    "original": "A luxury bag",
    "fr": "Un sac de luxe",
    "ht": "Yon valiz liks",
    "es": "Un bolso de lujo"
  },
  {
    "original": "A beautiful fashion watch designed to complement your style.",
    "fr": "Une belle montre tendance conçue pour compléter votre style.",
    "ht": "Yon bèl mont alamòd ki fèt pou konplete estil ou.",
    "es": "Un hermoso reloj de moda diseñado para complementar tu estilo."
  }
]$copy$::jsonb) as d(original text, fr text, ht text, es text)
where p.description = d.original;
