using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Democracy.TheyWorkForYou
{
    public class API
    {
        private const string ApiKey = "E3QpN7DQNcfuGKt9UzFHATgt";

        public string Query(string func, string[] args)
        {
            VerifyQueryArgs(func, args);
            var query = new Request(func, args, ApiKey);
            return ExecuteQuery(query);
        }

        private static void VerifyQueryArgs(string func, string[] args)
        {
            if (string.IsNullOrEmpty(func) || args == null)
            {
                throw new Exception("ERROR: Function name or arguments not provided.");
            }
        }

        private static string ExecuteQuery(Request query)
        {
            var url = query.EncodeArguments();

            var result = new StringBuilder();
            var buf = new byte[8192];
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.UserAgent = "Democracy Data Service";
            var response = (HttpWebResponse)request.GetResponse();
            var responseStream = response.GetResponseStream();
            var count = 0;
            do
            {
                if (responseStream != null) count = responseStream.Read(buf, 0, buf.Length);
                if (count != 0)
                {
                    result.Append(Encoding.ASCII.GetString(buf, 0, count));
                }
            } while (count > 0);
            return result.ToString();
        }
    }
}
