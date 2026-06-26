UPDATE public.sidebar_items
SET is_visible = false,
    updated_at = now()
WHERE key = 'meus_acompanhamentos'
   OR url = '/meus-acompanhamentos'
   OR label = 'Os Meus Acompanhamentos';

UPDATE public.sidebar_items
SET url = '/casos',
    label = 'Acompanhamento',
    updated_at = now()
WHERE key = 'casos'
   OR label = 'Acompanhamento';