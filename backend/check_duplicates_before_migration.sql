-- Run this BEFORE applying the unique constraint migration.
-- If this returns any rows, you have duplicates and must clean them first.
SELECT "userId", "weekStart", COUNT(*) AS total
FROM "Reservation"
GROUP BY "userId", "weekStart"
HAVING COUNT(*) > 1;

-- If duplicates exist, this query keeps the LATEST one and deletes the rest:
-- DELETE FROM "Reservation"
-- WHERE id NOT IN (
--     SELECT DISTINCT ON ("userId", "weekStart") id
--     FROM "Reservation"
--     ORDER BY "userId", "weekStart", "updatedAt" DESC
-- );
