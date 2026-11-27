/* CoreVista batch-operator menu (training member). */
signal on syntax name syntax_error

say 'COREVISTA BANK OPERATIONS'
say '1 - Submit end-of-day interest (EODINT)'
say '2 - Generate read-only statements (STMTGEN)'
say '3 - Request DB2 image copy (DB2COPY)'
say '4 - Show recent job status (JOBSTAT)'
pull choice

select
  when choice = '1' then job = 'EODINT'
  when choice = '2' then job = 'STMTGEN'
  when choice = '3' then job = 'DB2COPY'
  when choice = '4' then do
    address TSO "EXEC 'AETHR.REXX(JOBSTAT)'"
    exit 0
  end
  otherwise do
    say 'Invalid selection. No job was submitted.'
    exit 8
  end
end

say 'Submitting 'job' to JES.'
address TSO "SUBMIT 'AETHR.JCL("job")'"
if rc <> 0 then do
  say 'SUBMIT failed with return code 'rc
  exit rc
end
say 'Use SDSF or JOBSTAT to inspect spool and completion code.'
exit 0

syntax_error:
  say 'OPSMENU syntax error on line 'sigl
  exit 12
