       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBKINT01.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       EXEC SQL INCLUDE SQLCA END-EXEC.
       EXEC SQL
         DECLARE C-ACCT CURSOR FOR
           SELECT ACCT_NO, BALANCE, RATE, LAST_INT_DATE
             FROM AETHR.ACCOUNT
            WHERE STATUS = 'A'
              AND ACCT_TYPE IN ('SAV', 'FD')
            FOR UPDATE OF BALANCE, LAST_INT_DATE
       END-EXEC.
       01  HV-ACCT             PIC X(10).
       01  HV-BALANCE          PIC S9(13)V99 COMP-3.
       01  HV-RATE              PIC 9(3)V99 COMP-3.
       01  HV-LAST-DATE         PIC X(10).
       01  HV-DAYS              PIC 9(5) COMP.
       01  HV-INTEREST          PIC S9(13)V99 COMP-3.
       01  WS-COUNT             PIC 9(7) COMP VALUE 0.
       01  WS-TOTAL              PIC S9(13)V99 COMP-3 VALUE 0.
       PROCEDURE DIVISION.
       A-MAIN.
           PERFORM B-OPEN-CURSOR
           PERFORM C-FETCH-LOOP
           PERFORM E-CLOSE
           PERFORM F-SUMMARY
           GOBACK.
       B-OPEN-CURSOR.
           EXEC SQL OPEN C-ACCT END-EXEC.
       C-FETCH-LOOP.
           PERFORM UNTIL SQLCODE = 100
               EXEC SQL
                 FETCH C-ACCT
                   INTO :HV-ACCT, :HV-BALANCE, :HV-RATE,
                        :HV-LAST-DATE
               END-EXEC
               IF SQLCODE = 0
                   PERFORM D-POST-ONE
               END-IF
           END-PERFORM.
       D-POST-ONE.
           COMPUTE HV-DAYS = CURRENT DATE - HV-LAST-DATE
           IF HV-DAYS > 0
               COMPUTE HV-INTEREST ROUNDED =
                 HV-BALANCE * HV-RATE * HV-DAYS / 36500
               ADD HV-INTEREST TO HV-BALANCE
               ADD HV-INTEREST TO WS-TOTAL
               ADD 1 TO WS-COUNT
               EXEC SQL
                 UPDATE AETHR.ACCOUNT
                    SET BALANCE = :HV-BALANCE,
                        LAST_INT_DATE = CURRENT DATE
                  WHERE CURRENT OF C-ACCT
               END-EXEC
           END-IF.
       E-CLOSE.
           EXEC SQL CLOSE C-ACCT END-EXEC.
       F-SUMMARY.
           EXEC SQL COMMIT END-EXEC
           DISPLAY 'ACCOUNTS POSTED ' WS-COUNT
           DISPLAY 'TOTAL INTEREST ' WS-TOTAL.
