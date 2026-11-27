       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBKXFR01.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       EXEC SQL INCLUDE SQLCA END-EXEC.
       01  HV-FROM             PIC X(10).
       01  HV-TO               PIC X(10).
       01  HV-TELLER            PIC X(8).
       01  HV-FROM-TYPE         PIC X(3).
       01  HV-AMOUNT           PIC S9(13)V99 COMP-3.
       01  HV-FROM-BAL          PIC S9(13)V99 COMP-3.
       01  HV-TO-BAL            PIC S9(13)V99 COMP-3.
       01  HV-FROM-STATUS       PIC X.
       01  HV-TO-STATUS         PIC X.
       01  HV-FROM-KYC          PIC X.
       01  HV-MINIMUM           PIC S9(13)V99 COMP-3.
       01  HV-RESP              PIC X(3).
       LINKAGE SECTION.
       01  DFHCOMMAREA.
           05 CA-FROM           PIC X(10).
           05 CA-TO             PIC X(10).
           05 CA-AMOUNT         PIC S9(13)V99 COMP-3.
           05 CA-TELLER         PIC X(8).
           05 CA-RESP           PIC X(3).
       PROCEDURE DIVISION USING DFHCOMMAREA.
       A-MAIN.
           MOVE CA-FROM TO HV-FROM
           MOVE CA-TO TO HV-TO
           MOVE CA-AMOUNT TO HV-AMOUNT
           MOVE CA-TELLER TO HV-TELLER
           PERFORM B-VALIDATE
           PERFORM C-READ-FROM
           PERFORM D-READ-TO
           PERFORM E-APPLY-RULES
           PERFORM F-POST
           PERFORM G-REPLY
           EXEC CICS RETURN END-EXEC.
       B-VALIDATE.
           IF HV-FROM = HV-TO OR HV-AMOUNT <= 0
               MOVE 'E07' TO HV-RESP
               PERFORM Z-REJECT
           END-IF.
       C-READ-FROM.
           EXEC SQL
             SELECT ACCT_TYPE, BALANCE, STATUS
               INTO :HV-FROM-TYPE, :HV-FROM-BAL, :HV-FROM-STATUS
               FROM AETHR.ACCOUNT
              WHERE ACCT_NO = :HV-FROM
           END-EXEC
           IF SQLCODE NOT = 0
               MOVE 'E01' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           EXEC SQL
             SELECT C.KYC_STATUS
               INTO :HV-FROM-KYC
               FROM AETHR.CUSTOMER C, AETHR.ACCOUNT A
              WHERE A.CUST_ID = C.CUST_ID
                AND A.ACCT_NO = :HV-FROM
           END-EXEC.
           IF SQLCODE NOT = 0
               MOVE 'E01' TO HV-RESP
               PERFORM Z-REJECT
           END-IF.
       D-READ-TO.
           EXEC SQL
             SELECT BALANCE, STATUS
               INTO :HV-TO-BAL, :HV-TO-STATUS
               FROM AETHR.ACCOUNT
              WHERE ACCT_NO = :HV-TO
           END-EXEC
           IF SQLCODE NOT = 0
               MOVE 'E01' TO HV-RESP
               PERFORM Z-REJECT
           END-IF.
       E-APPLY-RULES.
           IF HV-FROM-STATUS NOT = 'A' OR HV-TO-STATUS NOT = 'A'
               MOVE 'E02' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           IF HV-FROM-KYC NOT = 'V'
               MOVE 'E04' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           IF HV-FROM-TYPE = 'FD'
               MOVE 'E03' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           IF HV-FROM-TYPE = 'SAV'
               MOVE 1000 TO HV-MINIMUM
           ELSE
               MOVE 5000 TO HV-MINIMUM
           END-IF
           IF HV-FROM-BAL - HV-AMOUNT < HV-MINIMUM
               MOVE 'E05' TO HV-RESP
               PERFORM Z-REJECT
           END-IF.
       F-POST.
           SUBTRACT HV-AMOUNT FROM HV-FROM-BAL
           ADD HV-AMOUNT TO HV-TO-BAL
           EXEC SQL
             UPDATE AETHR.ACCOUNT
                SET BALANCE = :HV-FROM-BAL
              WHERE ACCT_NO = :HV-FROM
           END-EXEC
           IF SQLCODE NOT = 0
               MOVE 'E07' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           EXEC SQL
             UPDATE AETHR.ACCOUNT
                SET BALANCE = :HV-TO-BAL
              WHERE ACCT_NO = :HV-TO
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
                :HV-FROM, CURRENT TIMESTAMP, 'D', :HV-AMOUNT,
                :HV-FROM-BAL, 'Transfer debit', 'CICS', :HV-TO,
                'CBKXFR01', :HV-TELLER)
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
                :HV-TO, CURRENT TIMESTAMP, 'C', :HV-AMOUNT,
                :HV-TO-BAL, 'Transfer credit', 'CICS', :HV-FROM,
                'CBKXFR01', :HV-TELLER)
           END-EXEC
           IF SQLCODE NOT = 0
               MOVE 'E07' TO HV-RESP
               PERFORM Z-REJECT
           END-IF
           EXEC SQL COMMIT END-EXEC.
       G-REPLY.
           MOVE '00' TO CA-RESP
           EXEC CICS RETURN END-EXEC.
       Z-REJECT.
           EXEC SQL ROLLBACK END-EXEC
           MOVE HV-RESP TO CA-RESP
           EXEC CICS RETURN END-EXEC.
