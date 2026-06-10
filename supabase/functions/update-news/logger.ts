// supabase/functions/update-news/logger.ts: A simple class for collecting and formatting logs.
// @ts-nocheck - This is a Deno file and should not be type-checked by the frontend's TypeScript compiler.
export class Logger {
  logs = [];
    summary = [];
      startTime;
        constructor(){
            this.startTime = Date.now();
              }
                add(level, message) {
                    const timestamp = new Date().toISOString();
                        const logMessage = `[${timestamp}] [${level}] ${message}`;
                            this.logs.push(logMessage);
                                // Also log to console for real-time debugging in Supabase logs
                                    if (level === 'ERROR') {
                                          console.error(logMessage);
                                              } else if (level === 'WARN') {
                                                    console.warn(logMessage);
                                                        } else {
                                                              console.log(logMessage);
                                                                  }
                                                                    }
                                                                      info(message) {
                                                                          this.add('INFO', message);
                                                                            }
                                                                              warn(message) {
                                                                                  this.add('WARN', message);
                                                                                    }
                                                                                      error(message) {
                                                                                          this.add('ERROR', message);
                                                                                            }
                                                                                              success(message) {
                                                                                                  this.add('SUCCESS', message);
                                                                                                    }
                                                                                                      addSummary(message) {
                                                                                                          this.summary.push(message);
                                                                                                            }
                                                                                                              getLogs = ()=>this.logs;
                                                                                                                getSummary = ()=>{
                                                                                                                    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
                                                                                                                        return [
                                                                                                                              `Start Time: ${new Date(this.startTime).toUTCString()}`,
                                                                                                                                    `End Time: ${new Date().toUTCString()}`,
                                                                                                                                          `Total Duration: ${duration} seconds`,
                                                                                                                                                ...this.summary
                                                                                                                                                    ];
                                                                                                                                                      };
                                                                                                                                                      }
