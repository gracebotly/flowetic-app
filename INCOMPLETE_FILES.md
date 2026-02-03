
# Incomplete Files for Authentication Migration

## DEFINITIVE STATUS

**Total files needing migration: 7**
**Files fully completed: 25**

## PARTIALLY COMPLETE FILES (1 file)

1. `mastra/tools/persistPreviewVersion.ts`
   - Has correct imports: ✅
   - Input schema updated: ✅  
   - BUT execute function still uses `createClient()` on line 23: ❌
   - Status: NEEDS AUTHENTICATION PATTERN IN EXECUTE FUNCTION

## COMPLETELY INCOMPLETE FILES (6 files)

These files have NO migration work done and use `createClient()`:

1. `mastra/tools/storeEvents.ts`
2. `mastra/tools/todo/todoAdd.ts`
3. `mastra/tools/todo/todoComplete.ts`
4. `mastra/tools/todo/todoList.ts`
5. `mastra/tools/todo/todoUpdate.ts` *(Note: has createAuthenticatedClient import but still uses createClient() in execute)*
6. `mastra/tools/todoComplete_backup.ts`

## FULLY COMPLETED FILES (25 files)

✅ All migrated to authenticated pattern:
- All Analysis, Deploy, Journey, Platform Mapping, Projects, Sources, and Spec Editor tools (19 files)
- generateSchemaSummaryFromEvents.ts (1 file)
- All supatools (6 files)

## WORK NEEDED

**For partially complete file:**
- Complete the execute function authentication pattern

**For completely incomplete files:**
- Add imports
- Update input schemas (remove tenantId parameters)
- Add authentication pattern to execute functions
