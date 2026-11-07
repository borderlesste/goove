-- Cover foreign-key lookups used by claim history and referential checks.
create index if not exists reward_claims_reward_code_id_idx
  on public.reward_claims(reward_code_id);
create index if not exists goove_archived_reward_codes_claim_id_idx
  on public.goove_archived_reward_codes(claim_id);
