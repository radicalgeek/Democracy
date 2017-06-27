using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.WindowsAzure.Storage;
using Microsoft.WindowsAzure.Storage.Blob;

namespace Democracy.Bills.Storage
{
    public class AzureFileStorage
    {
        private CloudStorageAccount storageAccount = CloudStorageAccount.Parse(ConfigurationManager.ConnectionStrings["StorageConnection"].ConnectionString);

        private string imageDirecoryUrl;

        public AzureFileStorage()
        {
            this.imageDirecoryUrl = GetUploadLocation();
            CloudBlobClient blobClient = storageAccount.CreateCloudBlobClient();

            CloudBlobContainer container = blobClient.GetContainerReference(imageDirecoryUrl);
            container.CreateIfNotExists();
            container.SetPermissions(
                new BlobContainerPermissions
                {
                    PublicAccess = BlobContainerPublicAccessType.Blob
                });
        }


        public string GetUploadLocation()
        {
            return "devstore";
        }

        public string SaveImage(string filePath)
        {
            CloudBlobClient blobClient = storageAccount.CreateCloudBlobClient();
            CloudBlobContainer container = blobClient.GetContainerReference(imageDirecoryUrl);

            CloudBlockBlob blockBlob = container.GetBlockBlobReference(Path.GetFileName(filePath));
            blockBlob.BeginUploadFromFile(filePath, FileMode.OpenOrCreate, null, null);
            return blockBlob.Uri.ToString();

        }
    }
}
