export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/corevista',
  tokenSecret: process.env.TOKEN_SECRET || 'corevista-lab-secret',
  /**
   * Lab runtime. On a real LPAR the same routes would call Zowe instead of ledger.js:
   *   zowe zos-jobs submit local-file mainframe/jcl/EODINT.jcl --wait-for-output
   *   zowe db2 execute sql --query "SELECT ..."
   * See mainframe/zowe/commands.txt.
   */
  runtime: 'lab-bridge'
};
