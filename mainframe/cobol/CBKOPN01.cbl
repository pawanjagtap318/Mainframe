       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBKOPN01.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       EXEC SQL INCLUDE SQLCA END-EXEC.
       01  HV-CUST             PIC X(8).
       01  HV-ACCT             PIC X(10).
       01  HV-TYPE             PIC X(3).
       01  HV-AMOUNT           PIC S9(13)V99 COMP-3.
       01  HV-RATE              PIC 9(3)V99 COMP-3.
       01  HV-TELLER            PIC X(8).
       01  HV-RESP              PIC X(3).
       LINKAGE SECTION.
       01  DFHCOMMAREA.
           05 CA-CUST           PIC X(8).
           05 CA-TYPE           PIC X(3).
           05 CA-AMOUNT         PIC S9(13)V99 COMP-3.
           05 CA-ACCT           PIC X(10).
           05 CA-TELLER         PIC X(8).
           05 CA-RESP           PIC X(3).
       PROCEDURE DIVISION USING DFHCOMMAREA.
       A-MAIN.
           MOVE CA-CUST TO HV-CUST
           MOVE CA-TYPE TO HV-TYPE
           MOVE CA-AMOUNT TO HV-AMOUNT
           MOVE CA-TELLER TO HV-TELLER
           PERFORM B-VALIDATE
           PERFORM C-INSERT
           PERFORM D-REPLY
           EXEC CICS RETURN END-EXEC.
       B-VALIDATE.
           IF HV-AMOUNT <= 0
               MOVE 'E07' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           IF HV-TYPE = 'SAV' AND HV-AMOUNT < 1000
               MOVE 'E10' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           IF HV-TYPE = 'CUR' AND HV-AMOUNT < 5000
               MOVE 'E10' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           IF HV-TYPE = 'FD' AND HV-AMOUNT < 10000
               MOVE 'E10' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           IF HV-TYPE NOT = 'SAV' AND HV-TYPE NOT = 'CUR'
             AND HV-TYPE NOT = 'FD'
               MOVE 'E11' TO HV-RESP
               PERFORM Z-REJECT
           END-IF.
       C-INSERT.
           EVALUATE HV-TYPE
             WHEN 'SAV' MOVE 4.00 TO HV-RATE
             WHEN 'CUR' MOVE 0.00 TO HV-RATE
             WHEN 'FD' MOVE 6.50 TO HV-RATE
           END-EVALUATE
           EXEC SQL
             SELECT DIGITS(DECIMAL(NEXT VALUE FOR AETHR.ACCT_SEQ,
                                   10, 0))
               INTO :HV-ACCT
               FROM SYSIBM.SYSDUMMY1
           END-EXEC
           EXEC SQL
             INSERT INTO AETHR.ACCOUNT
               (ACCT_NO, CUST_ID, ACCT_TYPE, BALANCE, RATE,
                STATUS, BRANCH_CODE, OPEN_DATE, LAST_INT_DATE)
             VALUES
               (:HV-ACCT, :HV-CUST, :HV-TYPE, :HV-AMOUNT,
                :HV-RATE, 'A', '0142', CURRENT DATE, CURRENT DATE)
           END-EXEC
           IF SQLCODE NOT = 0
               MOVE 'E07' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           EXEC SQL
             INSERT INTO AETHR.TXN
               (TXN_ID, ACCT_NO, TXN_TS, DR_CR, AMOUNT, BAL_AFTER,
                NARRATIVE, CHANNEL, RELATED_ACCT, PROGRAM_ID, TELLER_ID)
             VALUES
               (DIGITS(DECIMAL(NEXT VALUE FOR AETHR.TXN_SEQ, 12, 0)),
                :HV-ACCT, CURRENT TIMESTAMP, 'C', :HV-AMOUNT,
                :HV-AMOUNT, 'Opening deposit', 'CICS', NULL,
                'CBKOPN01', :HV-TELLER)
           END-EXEC
           IF SQLCODE NOT = 0
               MOVE 'E07' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           EXEC SQL COMMIT END-EXEC.
       D-REPLY.
           MOVE HV-ACCT TO CA-ACCT
           MOVE '00' TO CA-RESP.
       Z-REJECT.
           EXEC SQL ROLLBACK END-EXEC
           MOVE HV-RESP TO CA-RESP
           EXEC CICS RETURN END-EXEC.
