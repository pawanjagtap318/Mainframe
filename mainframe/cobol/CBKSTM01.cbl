       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBKSTM01.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       EXEC SQL INCLUDE SQLCA END-EXEC.
       EXEC SQL
         DECLARE C-STMT CURSOR FOR
           SELECT C.CUST_ID, C.FULL_NAME, A.ACCT_NO, A.ACCT_TYPE,
                  A.BALANCE, A.STATUS
             FROM AETHR.CUSTOMER C, AETHR.ACCOUNT A
            WHERE C.CUST_ID = A.CUST_ID
            ORDER BY C.CUST_ID, A.ACCT_NO
       END-EXEC.
       01  HV-CUST             PIC X(8).
       01  HV-NAME             PIC X(60).
       01  HV-ACCT             PIC X(10).
       01  HV-TYPE             PIC X(3).
       01  HV-BALANCE          PIC S9(13)V99 COMP-3.
       01  HV-STATUS           PIC X.
       01  WS-COUNT             PIC 9(7) COMP VALUE 0.
       PROCEDURE DIVISION.
       A-MAIN.
           PERFORM B-READ
           PERFORM D-SUMMARY
           GOBACK.
       B-READ.
           EXEC SQL OPEN C-STMT END-EXEC
           PERFORM UNTIL SQLCODE = 100
               EXEC SQL
                 FETCH C-STMT
                   INTO :HV-CUST, :HV-NAME, :HV-ACCT, :HV-TYPE,
                        :HV-BALANCE, :HV-STATUS
               END-EXEC
               IF SQLCODE = 0
                   PERFORM C-PRINT
               END-IF
           END-PERFORM
           EXEC SQL CLOSE C-STMT END-EXEC.
       C-PRINT.
           ADD 1 TO WS-COUNT
           DISPLAY HV-CUST ' ' HV-NAME ' ' HV-ACCT ' '
                   HV-TYPE ' ' HV-BALANCE ' ' HV-STATUS.
       D-SUMMARY.
           DISPLAY 'STATEMENT ROWS ' WS-COUNT
           DISPLAY 'READ ONLY - NO BALANCE WAS CHANGED'.
