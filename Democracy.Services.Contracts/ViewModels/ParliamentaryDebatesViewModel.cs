using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Democracy.Data.DataModels;

namespace Democracy.Services.Contracts.ViewModels
{
    public class ParliamentaryDebatesViewModel
    {
        public List<DebateDataModel> dabates;
        public string Title { get; set; }
        public string Stage { get; set; }
        public string House { get; set; }
    }
}
