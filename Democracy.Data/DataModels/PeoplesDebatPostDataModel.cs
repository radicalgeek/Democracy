using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Democracy.Models;

namespace Democracy.Data.DataModels
{
    public class PeoplesDebatPostDataModel
    {
        [Key]
        public int Id { get; set; }

        public int BillDataModelId { get; set; }
        public virtual BillDataModel BillDataModel { get; set; }

        [MaxLength]
        //[AllowHtml]
        public string Text { get; set; }

        public virtual ApplicationUser Author { get; set; }
        public DateTime Date { get; set; }
    }
}
