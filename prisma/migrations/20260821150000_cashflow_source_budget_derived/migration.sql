-- Nakit defteri artık bütçe/gerçekleşen satırlarından ÜRETİLEBİLİYOR.
-- Üretilmiş satırların ayrı bir kaynağı olması şart: yeniden üretim yalnızca
-- bunları siler, kullanıcının elle girdiği MANUAL satırlara dokunmaz.
ALTER TYPE "CashFlowEventSource" ADD VALUE 'BUDGET_DERIVED';
