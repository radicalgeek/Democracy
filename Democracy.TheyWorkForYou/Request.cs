using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Web;

namespace Democracy.TheyWorkForYou
{
    public class Request
    {
        private readonly string _url = "http://www.theyworkforyou.com/api/";

        private readonly string _func;
        private readonly string[] _args;
        private readonly string _apiKey;

        public Request(string func, string[] args, string apiKey)
        {
            _func = func;
            _args = args;
            _apiKey = apiKey;

            _url = GetUriForFunction(_func);

            if (string.IsNullOrEmpty(_url))
            {
                throw new Exception("ERROR: Invalid function: " + _func + ". Please look at the documentation for supported functions.");
            }
        }

        public string EncodeArguments()
        {
            ValidateOutputArguments();
            ValidateArgumentsForFunction();

            string fullUrl = BuildUrl();

            return fullUrl;
        }

        private string BuildUrl()
        {
            var fullUrl = _url + "?key=" + _apiKey + "&";
            foreach (String name in _args)
            {
                fullUrl += name.Split(':')[0] + "=" +  HttpUtility.UrlEncode(name.Split(':')[1]) + "&";
            }
            return fullUrl.Substring(0, fullUrl.Length - 1);
        }

        private void ValidateArgumentsForFunction()
        {
            if (!ValidateArguments(_func, _args))
            {
                throw new Exception("ERROR: All mandatory arguments for " + _func + " not provided.");
            }
        }

        private void ValidateOutputArguments()
        {
            for (int i = 0; i < _args.Length; i++)
            {
                if (_args[i].Split(':')[0] == "output")
                {
                    if (!ValidateOutputArgument(_args[i]))
                    {
                        throw new Exception("ERROR: Invalid output type: " + _args[i] +
                                            ". Please look at the documentation for supported output types.");
                    }
                    break;
                }
            }
        }

        private String GetUriForFunction(String func)
        {
            if (string.IsNullOrEmpty(func))
            {
                return string.Empty;
            }

            string[,] validFunctions = {
                                            {
                                                "getConstituency",
                                                "getConstituencies",
                                                "getPerson",
                                                "getMP",
                                                "getMPInfo",
                                                "getMPsInfo",
                                                "getMPs",
                                                "getLord",
                                                "getLords",
                                                "getMLA",
                                                "getMLAs",
                                                "getMSP",
                                                "getMSPs",
                                                "getGeometry",
                                                "getBoundary",
                                                "getCommittee",
                                                "getDebates",
                                                "getWrans",
                                                "getWMS",
                                                "getHansard",
                                                "getComments"
                                            },
                                            {
                                                "Searches for a UK Parliament constituency and returns details",
                                                "Returns list of UK Parliament constituencies",
                                                "Returns main details for a person",
                                                "Returns main details for an MP",
                                                "Returns extra information for a person",
                                                "Returns extra information for one or more people",
                                                "Returns list of MPs",
                                                "Returns details for a Lord",
                                                "Returns list of Lords",
                                                "Returns details for an MLA",
                                                "Returns list of MLAs",
                                                "Returns details for an MSP",
                                                "Returns list of MSPs",
                                                "Returns centre, bounding box of UK Parliament constituencies",
                                                "Returns boundary polygon of UK Parliament constituency",
                                                "Returns members of Select Committee",
                                                "Returns Debates (either Commons, Westminster Hall, or Lords)",
                                                "Returns Written Answers",
                                                "Returns Written Ministerial Statements",
                                                "Returns any of the above",
                                                "Returns comments"

                                            }
                                        };

            foreach (string name in validFunctions)
            {
                if (func == name)
                {
                    return _url + func;
                }
            }

            return string.Empty;
        }

        // Validate the "output" argument
        private bool ValidateOutputArgument(string output)
        {
            // Exit if any arguments are not defined
            if (string.IsNullOrEmpty(output))
            {
                return false;
            }

            // Define valid output types
            String[,] validParams = {
                                         {
                                             "xml",
                                             "php",
                                             "js",
                                             "rabx",
                                         },
                                         {
                                             "XML output",
                                             "Serialized PHP",
                                             "a JavaScript object",
                                             "RPC over Anything But XML",
                                         }
                                     };

            foreach (String name in validParams)
            {
                if (output.Split(':')[1] == name)
                {
                    return true;
                }
            }
            return false;
        }

        private bool ValidateArguments(string func, string[] args)
        {
            string[,] functionsMandatoryParams = {
                                             {
                                                "getConstituency",
                                                "getConstituencies",
                                                "getPerson",
                                                "getMP",
                                                "getMPInfo",
                                                "getMPsInfo",
                                                "getMPs",
                                                "getLord",
                                                "getLords",
                                                "getMLA",
                                                "getMLAs",
                                                "getMSP",
                                                "getMSPs",
                                                "getGeometry",
                                                "getBoundary",
                                                "getCommittee",
                                                "getDebates",
                                                "getWrans",
                                                "getWMS",
                                                "getHansard",
                                                "getComments"
                                             },
                                             {
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 "",
                                                 ""
                                             }
                                         };

            // Check to see if all mandatory arguments are present
            for (int i = 0; i < functionsMandatoryParams.Length / 2; i++)
            {
                if (functionsMandatoryParams[0, i] == func)
                {
                    if (functionsMandatoryParams[1, i] != "")
                    {
                        string[] requiredParams = functionsMandatoryParams[1, i].Split(',');
                        bool isset = false;
                        foreach (string param in requiredParams)
                        {
                            for (int k = 0; k < args.Length; k++)
                            {
                                if (args[k].Split(':')[0] == param)
                                {
                                    isset = true;
                                }
                            }
                            if (!isset)
                            {
                                return false;
                            }
                        }
                    }
                    return true;
                }
            }
            return false;
        }
    }

}
