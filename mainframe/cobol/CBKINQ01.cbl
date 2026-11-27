       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBKINQ01.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       EXEC SQL INCLUDE SQLCA END-EXEC.
       01  HV-ACCT             PIC X(10).
       01  HV-BALANCE          PIC S9(13)V99 COMP-3.
       01  HV-NAME             PIC X(60).
       01  HV-KYC              PIC X.
       01  RESP-CODE           PIC X(3).
       LINKAGE SECTION.
       01  DFHCOMMAREA.
           05 CA-ACCT           PIC X(10).
           05 CA-BALANCE        PIC S9(13)V99 COMP-3.
           05 CA-NAME           PIC X(60).
           05 CA-RESP           PIC X(3).
       PROCEDURE DIVISION USING DFHCOMMAREA.
       A-MAIN.
           MOVE CA-ACCT TO HV-ACCT
           PERFORM B-SELECT
           IF SQLCODE = 0
               PERFORM C-REPLY
           ELSE
               PERFORM Z-REJECT
           END-IF
           EXEC CICS RETURN END-EXEC.
       B-SELECT.
           EXEC SQL
             SELECT A.BALANCE, C.FULL_NAME, C.KYC_STATUS
               INTO :HV-BALANCE, :HV-NAME, :HV-KYC
               FROM AETHR.ACCOUNT A, AETHR.CUSTOMER C
              WHERE A.CUST_ID = C.CUST_ID
                AND A.ACCT_NO = :HV-ACCT
           END-EXEC.
       C-REPLY.
           MOVE HV-BALANCE TO CA-BALANCE
           MOVE HV-NAME TO CA-NAME
           MOVE '00' TO CA-RESP
           EXEC CICS RETURN END-EXEC.
       Z-REJECT.
           MOVE 'E01' TO CA-RESP
           EXEC CICS SYNCPOINT ROLLBACK END-EXEC
           EXEC CICS RETURN END-EXEC.
