/* JOBSTAT reads completed-run rows from the DB2 training catalog. */
signal on syntax name syntax_error

address TSO "DSN SYSTEM(DB2P)"
if rc <> 0 then do
  say 'Unable to attach to DB2 subsystem DB2P. RC='rc
  exit rc
end

address TSO "RUN PROGRAM(JOBSTAT) PLAN(CBKPLAN) LIB('AETHR.LOAD')"
run_rc = rc
address TSO "END"
if run_rc <> 0 then do
  say 'JOBSTAT ended with return code 'run_rc
  exit run_rc
end
exit 0

syntax_error:
  say 'JOBSTAT syntax error on line 'sigl
  exit 12
