
-- Move Currículos to Participantes group
UPDATE public.sidebar_items SET group_id='47014d29-3f5a-4d09-bae0-cea782238121', position=10 WHERE key='curriculos';

-- Move Projetos, Parceiros, Indicadores, Financiamentos to GESTÃO group
UPDATE public.sidebar_items SET group_id='c09536d9-91ff-41b3-b1d8-123f84008740', position=10 WHERE key='projetos';
UPDATE public.sidebar_items SET group_id='c09536d9-91ff-41b3-b1d8-123f84008740', position=11 WHERE key='parceiros';
UPDATE public.sidebar_items SET group_id='c09536d9-91ff-41b3-b1d8-123f84008740', position=12 WHERE key='indicadores';
UPDATE public.sidebar_items SET group_id='c09536d9-91ff-41b3-b1d8-123f84008740', position=13 WHERE key='financiamentos';
